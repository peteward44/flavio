import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as resolve from './resolve.js';
import * as util from './util.js';
import logger from "./logger.js";

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

function deleteDir( dir ) {
	try {
		const stat = fs.statSync( dir );
		if ( stat.isSymbolicLink() ) {
			fs.unlinkSync( dir );
		} else if ( stat.isDirectory() ) {
			fs.emptyDirSync( dir );
			fs.rmdirSync( dir );
		}
	} catch ( err ) {
	}
}

/**
 *
 *
 */
export async function clone( pkgdir, options, repoUrl, isLinked, snapshot ) {
	let freshClone = false;
	let cloneDir;
	if ( isLinked ) {
		cloneDir = path.join( options.linkdir, repoUrlToLinkDirString( repoUrl ) );
	} else {
		fs.ensureDirSync( path.dirname( pkgdir ) );
		deleteDir( pkgdir );
		cloneDir = pkgdir;
	}
	if ( !fs.existsSync( path.join( cloneDir, '.git' ) ) ) {
		fs.ensureDirSync( path.dirname( cloneDir ) );
		if ( fs.existsSync( cloneDir ) ) {
			deleteDir( cloneDir );
		}
		await snapshot.clone( repoUrl.url, cloneDir, { branch: repoUrl.target || 'master' } );
		const flavioJson = await snapshot.getFlavioJson();
		if ( flavioJson && flavioJson.lfs ) {
			await snapshot.initLFS( cloneDir );
		}
		freshClone = true;
	}
	
	if ( isLinked ) {
		fs.ensureDirSync( path.dirname( pkgdir ) );
		if ( fs.existsSync( pkgdir ) ) {
			try {
				fs.unlinkSync( pkgdir );
			} catch (err) {}
		}
		fs.symlinkSync( cloneDir, pkgdir, os.platform() === "win32" ? 'junction' : 'dir' );
		logger.log( 'info', `Linked ${pkgdir} -> ${cloneDir}` );
	}
	snapshot.markChanged();
	return freshClone;
}

// Removes any credentials and protocol from a URL so they can be compared correctly
function stripRepoUrl( repo ) {
	return repo.replace( /^http[s]*:\/\/(.*@)*/, '' );
}

/**
 * @returns {Promise.<string>} - Either 'url', 'target' or empty string, depending what has changed on the repo
 */
async function hasRepoChanged( snapshot, repo, dir ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	// make sure it's the same repo URL
	const localUrl = await snapshot.getBareUrl();
	if ( stripRepoUrl( localUrl ) !== stripRepoUrl( repoUrl.url ) ) {
		// Repository URL is different to pre-existing module "name"
		return 'url';
	}
	const targetCur = await snapshot.getTarget();
	if ( targetCur.tag && targetCur.tag !== repoUrl.target ) {
		return 'target';
	}
	if ( targetCur.commit && targetCur.commit !== repoUrl.target ) {
		return 'target';
	}
	if ( targetCur.branch && targetCur.branch !== repoUrl.target ) {
		return 'target';
	}
	return '';
}

/**
 * @returns {string} - Either "none", "clone", "switch"
 * - None for no changes made or required
 * - clone for a new repo was cloned
 * - switch for repo was there but checkout operation done to switch to correct branch
 */
export async function checkAndSwitch( snapshot, options, pkgdir, repo ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	let repoState = '';
	let isLinked = options.link !== false;
	if ( fs.existsSync( path.join( pkgdir, '.git' ) ) ) {
		// check if pkgdir is already pointing to right place. If it is, leave it alone
		repoState = await hasRepoChanged( snapshot, repo, pkgdir );
		if ( !repoState || repoState === '' ) {
			return "none";
		}
		try {
			// If the directory is a junction, it'll delete without throwing an error. If it's a proper directory, it will throw an exception
			fs.unlinkSync( pkgdir );
			isLinked = true;
		} catch ( err ) {
			isLinked = false;
		}
	}

	let status = "";
	let cloneDir;

	if ( isLinked ) {
		cloneDir = path.join( options.linkdir, repoUrlToLinkDirString( repoUrl ) );
	} else {
		cloneDir = pkgdir;
	}

	function recreateLinkIfRequired() {
		if ( isLinked ) {
			fs.ensureDirSync( path.dirname( pkgdir ) );
			if ( fs.existsSync( pkgdir ) ) {
				try {
					fs.unlinkSync( pkgdir );
				} catch ( err ) {
				}
			}
			fs.symlinkSync( cloneDir, pkgdir, os.platform() === "win32" ? 'junction' : 'dir' );
			logger.log( 'info', `Linked ${path.basename(pkgdir)} -> ${cloneDir}` );
		}
	}

	if ( !fs.existsSync( path.join( cloneDir, '.git' ) ) ) {
		fs.ensureDirSync( path.dirname( cloneDir ) );
		if ( fs.existsSync( cloneDir ) ) {
			try {
				fs.unlinkSync( cloneDir );
			} catch ( err ) {
			}
		}
		await snapshot.clone( repoUrl.url, cloneDir, { branch: repoUrl.target || 'master' } );
		const flavioJson = await snapshot.getFlavioJson();
		if ( flavioJson && flavioJson.lfs ) {
			await snapshot.initLFS();
		}
		status = "clone";
		recreateLinkIfRequired();
	} else {
		recreateLinkIfRequired();
		// need to check repo state again as could have changed if link wasn't correct
		repoState = await hasRepoChanged( snapshot, repo, pkgdir );
		// switch to right target if necessary
		if ( repoState === 'url' ) {
			// completely different repo - rename old directory to preverse data
			if ( fs.existsSync( pkgdir ) && cloneDir === pkgdir ) {
				const newPkgDir = findNewRepoDir( cloneDir );
				fs.renameSync( cloneDir, newPkgDir );
				// then clone new one
				if ( await clone( pkgdir, options, repoUrl, options.link, snapshot ) ) {
					status = "clone";
				} else {
					status = "switch";
				}
			}
		} else if ( repoState === 'target' ) {
			let targetObj = null;
			try {
				targetObj = await resolve.getTargetFromRepoUrl( snapshot, repo, cloneDir );
			} catch ( err ) {
				// "correct" branch not available - don't do checkout
			}
			if ( targetObj ) {
				await snapshot.checkout( targetObj.branch || targetObj.tag || targetObj.commit );
				status = "switch";
			}
		}
	}
	if ( status !== 'none' ) {
		snapshot.markChanged();
	}
	return status;
}

/**
 * If the CLI option remote-reset is specified, 
 *
 * @returns {boolean} - True if the branch was changed if it needs to, false otherwise
 */
export async function checkRemoteResetRequired( snapshot, targetObj, name, pkgdir, options, repoUrl ) {
	// either reset to name of branch specified in flavio.json, or to master if that doesn't exist
	const target = await snapshot.getTarget();
	if ( target.branch && targetObj.branch ) {
		if ( !await snapshot.doesRemoteBranchExist( target.branch ) ) {
			let targetBranchName = 'master';
			if ( targetObj.branch !== target.branch ) {
				// the current branch doesn't exist on remote, and the branch specified in the module repo url does, so we reset to that
				if ( await snapshot.doesRemoteBranchExist( targetObj.branch ) ) {
					targetBranchName = targetObj.branch;
				}
			}
			if ( !options.json ) {
				logger.log( 'info', util.formatConsoleDependencyName( name ), `Switching branch to "${targetBranchName}" from "${target.branch}" as remote branch no longer exists` );
			}
			
			return checkAndSwitch( snapshot, options, pkgdir, `${repoUrl.url}#${targetBranchName}` );
		}
	}
	return 'none';
}

export function getLinkedRepoDir( options, repoUrl ) {
	return path.join( options.linkdir, repoUrlToLinkDirString( repoUrl ) );
}
