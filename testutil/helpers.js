// Creates a local SVN repositiory using svnadmin to run tests against
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import uuid from 'uuid';
import caliber from '../';

const tempRoot = path.join( os.tmpdir(), 'caliber' );


export function createTempFolder( name ) {
	let p = tempRoot;
	if ( name ) {
		p = path.join( p, name );
	}
	p = path.join( p, uuid.v4() );
	fs.ensureDirSync(p);
	return p;
}


// replacement for mocha's it() method to return a promise instead of accept a callback
export function test(name, func) {
	it(name, () => {
		const tempDir = path.join( tempRoot, uuid.v4() );
		try {
			fs.ensureDirSync( tempDir );
			let prom = func( tempDir );
			prom = prom.then(() => {
				// only delete temp folder on successfull test
				try {
					fs.removeSync(tempDir);
				} catch (err) {
					console.error(`Could not delete temp folder for test '${name}'`);
				}
			});
			return prom;
		} catch (err) {
			return Promise.reject(err);
		}
		return Promise.resolve();
	});
}

export async function addProject(tempDir, transport, options, rootObj, rootBowerJson) {
	options.name = options.name || 'default';
	const dirname = uuid.v4();
	let targetDesc = options.targetDesc;
	if (targetDesc && targetDesc.type === 'tag') {
		// can't commit to a tag, so create a branch first then tag off that
		// targetDesc = {
			// type: 'branch',
			// name: 'branch_' + targetDesc.name
		// };
		targetDesc = null;
	}
	let { url, dir: absPath } = await transport.createRepo(path.resolve(path.join(tempDir, dirname)), { targetDesc });
	console.log(`Created repo ${url}`);
	const result = {
		url,
		targetDesc: options.targetDesc,
		dir: absPath,
		deps: {}
	};
	rootObj = rootObj || result;

	// create new caliber.json based on deps
	const bowerJson = {
		name: options.name,
		version: options.version || '0.0.1-snapshot.0',
		dependencies: {}
	};
	if (!rootBowerJson) {
		rootBowerJson = bowerJson;
	}

	// add given modules
	if (Array.isArray(options.modules)) {
		for (let i = 0; i < options.modules.length; ++i) {
			const mod = options.modules[i];
			// create repo for the module
			if (mod.external) {
				if (!mod.dontAddToParent) {
					bowerJson.dependencies[mod.name] = mod.version;
				}
			} else {
				const moduleResult = await addProject(tempDir, transport, mod, rootObj, rootBowerJson);
				if (!mod.dontAddToParent) {
					bowerJson.dependencies[mod.name] = transport.formatBowerDependencyUrl(moduleResult.url, mod.targetDesc);
				}
				result.deps[mod.name] = moduleResult;
				rootObj.deps[mod.name] = moduleResult; // add dependency to root result object for easy access of dependencies-of-dependencies in unit tests
			}
			if (!mod.external && !mod.dontAddToParent) {
				rootBowerJson.ex = rootBowerJson.ex || {};
				rootBowerJson.ex.links = rootBowerJson.ex.links || {};
				rootBowerJson.ex.links[mod.name] = {};
			}
		}
	}

	// add caliber.json
	if (!options.nobowerjson) {
		await transport.unCat(url, targetDesc, 'caliber.json', JSON.stringify(bowerJson, null, '\t'), 'Creating repo: Adding caliber.json');
	}

	// add any files
	if (Array.isArray(options.files)) {
		for (let i = 0; i < options.files.length; ++i) {
			const file = options.files[i];
			console.log('Adding file', url, file.path);
			await transport.unCat(url, targetDesc, file.path, file.contents || '', `Creating repo: Adding file ${path.basename(file.path)}`);
		}
	}

	if (options.targetDesc && options.targetDesc.type === 'tag') {
		const tagDir = createTempFolder(tempDir);
		try {
			await caliber.commands.clone({
				cwd: tagDir,
				url: transport.formatBowerDependencyUrl(url, targetDesc)
			});
			await caliber.commands.tag([], {
				cwd: tagDir,
				tagName: options.targetDesc.name
			});
		} finally {
			fs.removeSync(tagDir);
		}
	}

	return result;
}


export async function createRepo(tempDir, transport, options) {
	return await addProject(tempDir, transport, options);
}


export async function createRepoCheckout(tempDir, transport, options) {
	if (typeof tempDir !== 'string') {
		throw new Error('createRepoCheckout invalid argument');
	}
	options = options || {};
	options.name = options.name || 'main';

	const checkoutDir = path.resolve(path.join(tempDir, uuid.v4()));
	const result = await createRepo(tempDir, transport, options);
	result.checkoutDir = checkoutDir;

	// execute checkout command
	console.log(`Checking out to ${checkoutDir}`);
	if (options.checkoutMainOnly) {
		// only perform transport checkout on main project
		await transport.checkout(result.url, options.targetDesc, checkoutDir);
	} else {
		// perform full checkout including all bower deps
		await caliber.commands.clone(
			transport.formatBowerDependencyUrl(result.url, options.targetDesc),
			{
				cwd: checkoutDir
			}
		);
	}
	return result;
}


async function verifySingleCaliberJson(transport, command) {
	const testname = command.name || '';
	// cat contents of caliber.json file and make sure the dependencies match up to the ones specified in the arguments
	const source = command.source;
	const bowerJsonText = await transport.cat(source.url, source.targetDesc, 'caliber.json');
	const json = JSON.parse(bowerJsonText);
	const test = command.test;

	if (test) {
		if (test.version) {
			if (test.version !== json.version) {
				console.error(`${testname}: Version actual ${json.version} expected ${test.version}`);
				return false;
			}
		}
		if (test.ex) {
			if (!json.ex) {
				console.error(`${testname}: expected 'ex' object in JSON - not there!`);
				return false;
			}
			if (typeof test.ex.tagLocalChanges !== 'undefined') {
				if (test.ex.tagLocalChanges !== json.ex.tagLocalChanges) {
					console.error(`${testname}: tagLocalChanges actual ${json.ex.tagLocalChanges.toString()} expected ${test.ex.tagLocalChanges}`);
					return false;
				}
			}
			if (typeof test.ex.tagTarget !== 'undefined') {
				if (!json.ex.tagTarget) {
					console.error(`${testname}: tagTarget actual null expected ${JSON.stringify(test.ex.tagTarget)}`);
					return false;
				}

				if (test.ex.tagTarget.name !== 'undefined') {
					if (test.ex.tagTarget.name !== json.ex.tagTarget.name) {
						console.error(`${testname}: tagTarget.name actual ${json.ex.tagTarget.name} expected ${test.ex.tagTarget.name}`);
						return false;
					}
				}
				if (test.ex.tagTarget.type !== 'undefined') {
					if (test.ex.tagTarget.type !== json.ex.tagTarget.type) {
						console.error(`${testname}: tagTarget.type actual ${json.ex.tagTarget.type} expected ${test.ex.tagTarget.type}`);
						return false;
					}
				}
			}
		}
		if (test.deps && test.deps.length > 0) {
			if (json.dependencies) {
				for (let i = 0; i < test.deps.length; ++i) {
					const dep = test.deps[i];
					if (json.dependencies.hasOwnProperty(dep.name)) {
						const url = json.dependencies[dep.name];
						if (url !== dep.url) {
							console.error(`${testname}: Dependency ${dep.name} actual url ${url} expected ${dep.url}`);
							return false;
						}
					}
				}
			}
		}
	}
	return true;
}


export async function verifyCaliberJson(transport, commands) {
	if (!Array.isArray(commands)) {
		commands = [commands];
	}
	for (let i = 0; i < commands.length; ++i) {
		const ok = await verifySingleCaliberJson(transport, commands[i]);
		if (!ok) {
			return false;
		}
	}
	return true;
}
