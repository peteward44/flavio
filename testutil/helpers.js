// Creates a local SVN repositiory using svnadmin to run tests against
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as uuid from 'uuid';
import * as util from '../src/util.js';
import executeGit from '../src/executeGit.js';

// windows paths are too long
const tempRoot = os.platform() === 'win32' ? path.join( path.parse( os.tmpdir() ).root, '.flaviotemp' ) : path.join( os.tmpdir(), 'flavio' );

export function createTempFolder( name ) {
	let p = tempRoot;
	if ( name ) {
		p = path.join( p, name );
	}
	p = path.join( p, uuid.v4() );
	fs.ensureDirSync(p);
	return p;
}

function executeTest( name, func, options ) {
	const tempDir = path.join( tempRoot, uuid.v4() );
	options.linkdir = path.join( tempDir, 'linked' );
	util.overrideDefaultOptions( options );
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
}

function doit( harnessIt, that, name, func ) {
	const optionMap = {
		'linked': {
			link: true
		},
		'unlinked': {
			link: false
		}
	};
	for ( const [optionName, options] of Object.entries( optionMap ) ) {
		const fullName = `${name}: ${optionName}`;
		harnessIt( fullName, executeTest.bind( that, fullName, func, options ) );
	}
}

// replacement for mocha's it() method to return a promise instead of accept a callback
export function test(name, func) {
	return doit( it, this, name, func );
}

test.only = function(name, func) {
	return doit( it.only, this, name, func );
};

test.skip = function(name, func) {
	return doit( it.skip, this, name, func );
};

function touchFile( filepath, contents ) {
	const dir = path.dirname( filepath );
	fs.ensureDirSync( dir );
	fs.writeFileSync( filepath, contents );
	return Promise.resolve();
}

export async function createRepo( dir, checkoutDir, options = {} ) {
	const alreadyExists = fs.existsSync( dir );
	
	if ( !alreadyExists ) {
		// see http://stackoverflow.com/questions/2337281/how-do-i-do-an-initial-push-to-a-remote-repository-with-git
		fs.ensureDirSync( dir );
		fs.ensureDirSync( checkoutDir );

		// init bare repo
		await executeGit( dir, ['init', '--bare', dir] );
		// init checkout repo
		await executeGit( checkoutDir, ['init', checkoutDir] );
	
		// create empty .gitignore file as we need one file to create the HEAD revision
		await touchFile( path.join( checkoutDir, '.gitignore' ), '' );
		
		// do add
		await executeGit( checkoutDir, ['add', '.'] );
		// then perform a commit so the HEAD revision exists on master
		await executeGit( checkoutDir, ['commit', '-m', 'Creating repo: Initial commit'] );

		// add remote origin
		await executeGit( checkoutDir, ['remote', 'add', 'origin', dir] );
		await executeGit( checkoutDir, ['push', '-u', 'origin', 'master'] );
	} else {
		console.log( `Already exists ${dir} ${checkoutDir}` );
		fs.ensureDirSync( checkoutDir );
		await executeGit( checkoutDir, ['clone', dir, checkoutDir] );
	}
	
	let tempTagBranchName;
	
	if ( options.branch ) {
		// switch to branch before adding files
		await executeGit( checkoutDir, ['checkout', '-b', options.branch] );
	} else if ( options.tag ) {
		// if a tag is defined, create temporary branch to put files on
		tempTagBranchName = uuid.v4();
		await executeGit( checkoutDir, ['checkout', '-b', tempTagBranchName] );
	}
	
	// add any files
	if ( Array.isArray(options.files) && options.files.length > 0 ) {
		let added = 0;
		for (let i = 0; i < options.files.length; ++i) {
			const file = options.files[i];
			const fullPath = path.join( checkoutDir, file.path );
			if ( !fs.existsSync( fullPath ) ) {
				console.log('Adding file', file.path);
				await touchFile( fullPath, file.contents || '' );
				added++;
			}
		}
		// do add
		if ( added > 0 ) {
			await executeGit( checkoutDir, ['add', '.'] );
			await executeGit( checkoutDir, ['commit', '-m', 'Creating repo: Adding files'] );
		}
	}
	
	if ( options.tag ) {
		await executeGit( checkoutDir, ['tag', '-a', options.tag, '-m', `Creating repo: Creating tag ${options.tag}`] );			
	}
	if ( tempTagBranchName ) {
		// delete local branch for tag
		await executeGit( checkoutDir, ['checkout', 'master'] );
		await executeGit( checkoutDir, ['branch', '-D', tempTagBranchName] );
	}
	// push
	//await executeGit( [ 'push', '-u', 'origin', name ], { cwd: checkoutDir } );
	await executeGit( checkoutDir, ['push', '--all'] );
	if ( options.tag ) {
		await executeGit( checkoutDir, ['push', 'origin', options.tag] );
	}
}

export async function addProject( tempDir, project, rootObj = null, repoMap = new Map() ) {
	project.name = project.name || 'default';
	if ( !repoMap.has( project.name ) ) {
		repoMap.set( project.name, uuid.v4() );
	}
	const repoId = repoMap.get( project.name );
	const repoDir = path.resolve( path.join( tempDir, repoId ) );
	const checkoutDir = path.resolve( path.join( tempDir, uuid.v4() ) );

	// create new flavio.json based on deps
	const flavioJson = {
		name: project.name,
		version: project.version || '0.0.1-snapshot.0',
		dependencies: {}
	};
	
	let result = {
		repoDir,
		checkoutDir,
		deps: {},
		alldeps: {}
	};
	if ( !rootObj ) {
		rootObj = result;
	}
	
	// add given modules
	if (Array.isArray(project.modules)) {
		for (let i = 0; i < project.modules.length; ++i) {
			const mod = project.modules[i];
			// create repo for the module
			const moduleResult = await addProject( tempDir, mod, rootObj, repoMap );
			if (!mod.dontAddToParent) {
				let target = 'master';
				if ( mod.tag ) {
					target = mod.tag;
				} else if ( mod.branch ) {
					target = mod.branch;
				}
				flavioJson.dependencies[mod.name] = `${moduleResult.repoDir}#${target}`;
			}
			result.deps[mod.name] = moduleResult;
			rootObj.alldeps[mod.name] = moduleResult; // add dependency to root result object for easy access of dependencies-of-dependencies in unit tests
		}
	}

	// add flavio.json
	const files = Array.isArray( project.files ) ? project.files.slice(0) : [];
	if (!project.noflaviojson) {
		files.push( { path: 'flavio.json', contents: JSON.stringify( flavioJson, null, '\t' ) } );
	}

	await createRepo( repoDir, checkoutDir, { files, branch: project.branch, tag: project.tag } );
	console.log(`Created repo ${repoDir}`);

	return result;
}
