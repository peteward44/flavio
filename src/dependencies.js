import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as git from './git.js';
import * as resolve from './resolve.js';
import * as util from './util.js';


function findNewRepoDir( pkgdir ) {
	let index = 0;
	let newdir;
	do {
		newdir = `${pkgdir}_${index}`;
		index++;
	} while ( fs.existsSync( newdir ) );
	return newdir;
}

function repoUrlToLinkDirString( repoUrl ) {
	let result = `${repoUrl.url}~${repoUrl.target}`;
	result = result.replace( /^http(s?):\/\//g, '' );
	result = result.replace( /[\\/:"*?<>|.]+/g, '_' );
	return result;
}

/**
 *
 *
 */
export async function clone( pkgdir, options, repoUrl, isLinked ) {
	let cloneDir;
	if ( isLinked ) {
		cloneDir = path.join( options.linkdir, repoUrlToLinkDirString( repoUrl ) );
	} else {
		if ( fs.existsSync( pkgdir ) ) {
			fs.emptyDirSync( pkgdir );
			fs.unlinkSync( pkgdir );
		}
		cloneDir = pkgdir;
	}
	if ( !fs.existsSync( path.join( cloneDir, '.git' ) ) ) {
		fs.ensureDirSync( path.dirname( cloneDir ) );
		if ( fs.existsSync( cloneDir ) ) {
			try {
				fs.unlinkSync( cloneDir );
			} catch ( err ) {
			}
		}
		await git.clone( repoUrl.url, cloneDir, { branch: repoUrl.target || 'master', depth: options.depth } );
		const flavioJson = await util.loadFlavioJson( cloneDir );
		if ( flavioJson && flavioJson.lfs ) {
			await git.initLFS( cloneDir );
		}
	}
	
	if ( isLinked ) {
		console.log( `Creating symlink cloneDir=${cloneDir} pkgdir=${pkgdir}` );
		fs.ensureDirSync( path.dirname( pkgdir ) );
		if ( fs.existsSync( pkgdir ) ) {
			try {
				fs.unlinkSync( pkgdir );
			} catch ( err ) {
			}
		}
		fs.symlinkSync( cloneDir, pkgdir, os.platform() === "win32" ? 'junction' : 'dir' );
		console.log( `Linked ${pkgdir} -> ${cloneDir}` );
	}
}


export async function checkAndSwitch( options, pkgdir, repo ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	let repoState = '';
	let isLinked = options.link !== false;
	if ( fs.existsSync( path.join( pkgdir, '.git' ) ) ) {
		// check if pkgdir is already pointing to right place. If it is, leave it alone
		repoState = await util.hasRepoChanged( repo, pkgdir );
		if ( !repoState || repoState === '' ) {
			return false;
		}
		try {
			// If the directory is a junction, it'll delete without throwing an error. If it's a proper directory, it will throw an exception
			fs.unlinkSync( pkgdir );
			isLinked = true;
		} catch ( err ) {
			isLinked = false;
		}
	}
	let cloneDir;
	if ( isLinked ) {
		cloneDir = path.join( options.linkdir, repoUrlToLinkDirString( repoUrl ) );
	} else {
		cloneDir = pkgdir;
	}
	if ( !fs.existsSync( path.join( cloneDir, '.git' ) ) ) {
		fs.ensureDirSync( path.dirname( cloneDir ) );
		if ( fs.existsSync( cloneDir ) ) {
			try {
				fs.unlinkSync( cloneDir );
			} catch ( err ) {
			}
		}
		await git.clone( repoUrl.url, cloneDir, { branch: repoUrl.target || 'master', depth: options.depth } );
		const flavioJson = await util.loadFlavioJson( cloneDir );
		if ( flavioJson && flavioJson.lfs ) {
			await git.initLFS( cloneDir );
		}
	} else {
		// switch to right target if necessary
		if ( repoState === 'url' ) {
			// completely different repo - rename old directory to preverse data
			if ( fs.existsSync( pkgdir ) && cloneDir === pkgdir ) {
				const newPkgDir = findNewRepoDir( cloneDir );
				fs.renameSync( cloneDir, newPkgDir );
			}
			// then clone new one
			await clone( pkgdir, options, repoUrl, options.link );
		} else if ( repoState === 'target' ) {
			const targetObj = await resolve.getTargetFromRepoUrl( repo, cloneDir );
			await git.checkout( cloneDir, targetObj );
		}
	}
	
	if ( isLinked ) {
		console.log( `(CheckAndSwitch) Creating symlink cloneDir=${cloneDir} pkgdir=${pkgdir}` );
		fs.ensureDirSync( path.dirname( pkgdir ) );
		if ( fs.existsSync( pkgdir ) ) {
			try {
				fs.unlinkSync( pkgdir );
			} catch ( err ) {
			}
		}
		fs.symlinkSync( cloneDir, pkgdir, os.platform() === "win32" ? 'junction' : 'dir' );
		console.log( `Linked ${path.basename(pkgdir)} -> ${cloneDir}` );
	}
	return true;
}


/**
 * If the CLI option remote-reset is specified, 
 *
 * @returns {boolean} - True if the branch was changed if it needs to, false otherwise
 */
export async function checkRemoteResetRequired( targetObj, name, module, options, repoUrl ) {
	const pkgdir = module.dir;
	// either reset to name of branch specified in flavio.json, or to master if that doesn't exist
	const target = await git.getCurrentTarget( pkgdir );
	if ( target.branch && targetObj.branch ) {
		if ( !await git.doesRemoteBranchExist( repoUrl.url, target.branch ) ) {
			let targetBranchName = 'master';
			if ( targetObj.branch !== target.branch ) {
				// the current branch doesn't exist on remote, and the branch specified in the module repo url does, so we reset to that
				if ( await git.doesRemoteBranchExist( repoUrl.url, targetObj.branch ) ) {
					targetBranchName = targetObj.branch;
				}
			}
			if ( !options.json ) {
				console.log( util.formatConsoleDependencyName( name ), `Switching branch to "${targetBranchName}" from "${target.branch}" as remote branch no longer exists` );
			}
			
			await checkAndSwitch( options, pkgdir, `${repoUrl.url}#${targetBranchName}` );
			return true;
		}
	}
	return false;
}
