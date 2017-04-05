import path from 'path';
import fs from 'fs-extra';
import uuid from 'uuid';
import os from 'os';
import { spawn } from 'child_process';

function getTempDir() {
	const p = path.join( os.tmpdir(), uuid.v4() );
	fs.ensureDirSync( p );
	return p;
}


function printError( err, args ) {
	let argsString = args.join( " " );
	console.error( "'git " + argsString + "'" );
	console.error( err );
}


function executeGit( args, options ) {
	options = options || {};
	return new Promise( ( resolve, reject ) => {
		let stdo = '';
		let proc = spawn( 'git', args, { cwd: options.cwd ? options.cwd : process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] } );

		function unpipe() {
		}

		if ( options.captureStdout ) {
			proc.stdout.on( 'data', ( data ) => {
				stdo += data.toString();
			} );
		}
		proc.on( 'error', ( err ) => {
			unpipe();
			if ( options.ignoreError ) {
				resolve( { out: stdo, code: 0 } );
			} else {
				printError( err, args );
				reject( err );
			}
		} );
		proc.on( 'exit', ( code ) => {
			unpipe();
		} );
		proc.on( 'close', ( code ) => {
			unpipe();
			if ( code !== 0 && !options.ignoreError ) {
				if ( !options.quiet ) {
					printError( '', args );
				}
				reject( new Error( "Error running git" ) );
			} else {
				resolve( { out: stdo, code: code } );
			}
		} );
	} );
}

function touchFile( filepath, contents ) {
	const dir = path.dirname( filepath );
	fs.ensureDirSync( dir );
	fs.writeFileSync( filepath, contents );
	return Promise.resolve();
}


export async function createRepo( dir, checkoutDir, options = {} ) {
	// see http://stackoverflow.com/questions/2337281/how-do-i-do-an-initial-push-to-a-remote-repository-with-git
	fs.ensureDirSync( dir );
	fs.ensureDirSync( checkoutDir );
	// init bare repo
	await executeGit( ['init', '--bare', dir] );
	// init checkout repo
	await executeGit( ['init', checkoutDir] );
	
	// create empty .gitignore file as we need one file to create the HEAD revision
	await touchFile( path.join( checkoutDir, '.gitignore' ), '' );
	
	// do add
	await executeGit( ['add', '.'], { cwd: checkoutDir } );
	// then perform a commit so the HEAD revision exists on master
	await executeGit( ['commit', '-m', 'Creating repo: Initial commit'], { cwd: checkoutDir } );

	// add remote origin
	await executeGit( ['remote', 'add', 'origin', dir], { cwd: checkoutDir } );
	await executeGit( ['push', '-u', 'origin', 'master'], { cwd: checkoutDir } );
	
	if ( options.branch ) {
		await executeGit( ['checkout', '-b', options.branch], { cwd: checkoutDir } );
	}
	
	// add any files
	if ( Array.isArray(options.files) && options.files.length > 0 ) {
		for (let i = 0; i < options.files.length; ++i) {
			const file = options.files[i];
			console.log('Adding file', file.path);
			await touchFile( path.join( checkoutDir, file.path ), file.contents || '' );
		}
		// do add
		await executeGit( ['add', '.'], { cwd: checkoutDir } );
		await executeGit( ['commit', '-m', 'Creating repo: Adding files'], { cwd: checkoutDir } );
	}
	
	if ( options.tag ) {
		await executeGit( ['tag', '-a', options.tag, '-m', `Creating repo: Creating tag ${options.tag}`], { cwd: checkoutDir } );			
	}
	// push
	//await executeGit( [ 'push', '-u', 'origin', name ], { cwd: checkoutDir } );
	await executeGit( ['push', '--all'], { cwd: checkoutDir } );
}


export async function addProject( tempDir, project, rootObj = null ) {
	project.name = project.name || 'default';
	const repoDir = path.resolve( path.join( tempDir, uuid.v4() ) );
	const checkoutDir = path.resolve( path.join( tempDir, uuid.v4() ) );

	// create new caliber.json based on deps
	const caliberJson = {
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
			const moduleResult = await addProject( tempDir, mod, rootObj );
			if (!mod.dontAddToParent) {
				let target = 'master';
				if ( mod.tag ) {
					target = mod.tag;
				} else if ( mod.branch ) {
					target = mod.branch;
				}
				caliberJson.dependencies[mod.name] = `${moduleResult.repoDir}#${target}`;
			}
			result.deps[mod.name] = moduleResult;
			rootObj.alldeps[mod.name] = moduleResult; // add dependency to root result object for easy access of dependencies-of-dependencies in unit tests
		}
	}

	// add caliber.json
	const files = Array.isArray( project.files ) ? project.files.slice(0) : [];
	if (!project.nocaliberjson) {
		files.push( { path: 'caliber.json', contents: JSON.stringify( caliberJson, null, '\t' ) } );
	}

	await createRepo( repoDir, checkoutDir, { files, branch: project.branch, tag: project.tag } );
	console.log(`Created repo ${repoDir}`);

	return result;
}


/** Gets the contents of a file
 * @param {string} url URL
 * @param {object} [targetDesc] Target description
 * @param {string} filepath Path of file to create
 * @returns {string} File contents
 */
export async function cat( url, filepath, options = {} ) {
	// http://stackoverflow.com/questions/2466735/how-to-checkout-only-one-file-from-git-repository
	let text = '';
	const tempDir = path.join( os.tmpdir(), uuid.v4() );
	fs.ensureDirSync( tempDir );
	try {
		let bname = 'master';
		let checkoutName = 'master';
		if ( options.tag ) {
			bname = `tags/${options.tag}`;
			checkoutName = options.tag;
		} else if ( options.branch ) {
			bname = options.branch;
			checkoutName = options.branch;
		}
		// clone repo to temp dir first
		await executeGit( ['clone', url, tempDir, '--no-checkout', '-b', checkoutName] );
		// checkout single file from repo
		await executeGit( ['checkout', bname, filepath], { cwd: tempDir } );
		// then read in file
		text = fs.readFileSync( path.join( tempDir, filepath ), 'utf8' );
	}	finally {
		fs.removeSync( tempDir );
	}
	return text;
}


export async function getCurrentTarget( dir ) {
	// from http://stackoverflow.com/questions/18659425/get-git-current-branch-tag-name
	try {
		let result = ( await executeGit( ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: dir, ignoreError: true, captureStdout: true } ) );
		let name = result.out.trim();
		if ( result.code === 0 && name.length > 0 ) {
			return { branch: name };
		}
	}	catch ( e ) {}

	const tag = await executeGit( ['describe', '--tags', '--exact-match'], { cwd: dir, captureStdout: true } );
	return { tag: tag.out.trim() };
}


/** Gets information on a working copy
 * @param {string} dir Working copy directory
 * @returns {string} Repo url
 */
export async function getWorkingCopyUrl( dir ) {
	// git is a bit more complicated than svn as a repo can have multiple remotes.
	// always assume 'origin' - TODO: allow an option to change this behaviour
	const result = await executeGit( ['config', '--get', 'remote.origin.url'], { cwd: dir, captureStdout: true } );
	const url = result.out.trim();
	const target = await getCurrentTarget( dir );
	return `${url}#${target.branch || target.tag}`;
}


export async function clone( url, dir, options = {} ) {
	dir = path.resolve( dir );
	fs.ensureDirSync( dir );
	await executeGit( ['clone', url, dir, ...( options.minimal ? ['--no-checkout'] : [] )] );
	if ( options.tag ) {
		await executeGit( ['checkout', `tags/${options.tag}`], { cwd: dir } );
	} else if ( options.branch ) {
		await executeGit( ['checkout', options.branch], { cwd: dir } );
	}
}


/** Lists all the tags that are part of the repository
 * @param {string} url URL
 */
export async function listTags( url ) {
	let tempDir = getTempDir();
	let result = [];
	try {
		await clone( url, tempDir, { minimal: true } );
		let out = ( await executeGit( ['tag'], { cwd: tempDir, captureStdout: true } ) ).out.trim();
		let array = out.split( '\n' );
		for ( let i=0; i<array.length; ++i ) {
			let t = array[i].trim();
			if ( t.length > 0 ) {
				result.push( t );
			}
		}
	}	finally {
		fs.removeSync( tempDir );
	}
	return result;
}


/** Checks if a working copy is clean
 * @param {string} dir Working copy
 * @param {string|Array} [filename] Optional specific filename to check
 */
export async function isWorkingCopyClean( dir, filename ) {
	let args = ['diff', 'HEAD'];
	if ( filename ) {
		args.push( '--' );
		if ( Array.isArray( filename ) ) {
			args = args.concat( filename );
		} else {
			args.push( filename );
		}
	}
	let out = ( await executeGit( args, { cwd: dir, captureStdout: true } ) ).out;
	out.trim();
	return out.length === 0;
}


export async function stash( dir ) {
	let clean = await isWorkingCopyClean( dir );
	const stashName = uuid.v4();
	if ( !clean ) {
		await executeGit( ['stash', 'save', stashName], { cwd: dir } );
		// check if it got saved
		const listOut = ( await executeGit( ['stash', 'list'], { cwd: dir, captureStdout: true } ) ).out;
		if ( !listOut.match( stashName ) ) {
			clean = true;
		}
	}
	return clean ? null : stashName;
}


export async function stashPop( dir, stashName ) {
	if ( stashName ) {
		await executeGit( ['stash', 'pop'], { cwd: dir } );
	}
}


export async function pull( dir ) {
	const target = await getCurrentTarget( dir );
	if ( target.branch ) {
		await executeGit( ['pull'], { cwd: dir } );
	}
}

export async function checkout( dir, target ) {
	if ( target.branch ) {
		await executeGit( ['checkout', target.branch], { cwd: dir } );
	} else if ( target.tag ) {
		await executeGit( ['checkout', `tags/${target.tag}`], { cwd: dir } );
	}
}

export async function addRemoteFile( filePath, fileContents, url, target ) {
	const tempDir = path.join( os.tmpdir(), uuid.v4() );
	fs.ensureDirSync( tempDir );
	try {
		let bname = 'master';
		if ( target.tag ) {
			throw new Error( `Can not commit a new file to a tag` );
		} else if ( target.branch && target.branch !== 'master' ) {
			bname = target.branch;
		}
		// clone repo to temp dir first
		await executeGit( ['clone', url, tempDir, '--no-checkout', '-b', bname] );
		// create file
		fs.writeFileSync( path.join( tempDir, filePath ), fileContents );
		await executeGit( ['add', filePath], { cwd: tempDir } );
		await executeGit( ['commit', filePath, '-m', `Added file ${filePath}`], { cwd: tempDir } );
		await executeGit( ['push'], { cwd: tempDir } );
	} finally {
		fs.removeSync( tempDir );
	}
}

