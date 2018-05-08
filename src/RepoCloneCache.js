import fs from 'fs-extra';
import * as git from './git.js';
import * as resolve from './resolve.js';
import * as util from './util.js';
import handleConflict from './handleConflict.js';


function findNewRepoDir( pkgdir ) {
	let index = 0;
	let newdir;
	do {
		newdir = `${pkgdir}_${index}`;
		index++;
	} while ( fs.existsSync( newdir ) );
	return newdir;
}


async function changeRepo( pkgdir, repo, options ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	const repoState = await util.hasRepoChanged( repo, pkgdir );
	if ( repoState === 'url' ) {
		// completely different repo - rename old directory to preverse data
		const newPkgDir = findNewRepoDir( pkgdir );
		fs.renameSync( pkgdir, newPkgDir );
		// then clone new one
		await git.clone( repoUrl.url, pkgdir, { master: true, depth: options.depth } );
		const targetObj = await resolve.getTargetFromRepoUrl( repo, pkgdir );
		await git.checkout( pkgdir, targetObj );
	} else if ( repoState === 'target' ) {
		const targetObj = await resolve.getTargetFromRepoUrl( repo, pkgdir );
		await git.checkout( pkgdir, targetObj );
	}
}

/**
 *
 *
 */
async function doFreshClone( name, module, options, repoUrl ) {
	const pkgdir = module.dir;
	if ( !options.json ) {
		console.log( util.formatConsoleDependencyName( name ), `Repository missing, performing fresh clone...` );
	}
	await git.clone( repoUrl.url, pkgdir, { master: true, depth: options.depth } );
	const targetObj = await resolve.getTargetFromRepoUrl( module.repo, pkgdir );
	try {
		await git.checkout( pkgdir, targetObj );
	} catch ( err ) {
		let type;
		if ( targetObj.branch ) {
			type = 'branch';
		} else if ( targetObj.tag ) {
			type = 'tag';
		} else {
			type = 'commit';
		}
		console.error( util.formatConsoleDependencyName( name ), `Could not checkout ${type} ${targetObj.branch || targetObj.tag || targetObj.commit}` );
	}
}

/**
 * If the CLI option remote-reset is specified, 
 *
 * @returns {boolean} - True if the branch was changed if it needs to, false otherwise
 */
async function checkRemoteResetRequired( targetObj, name, module, options, repoUrl ) {
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
			const stashName = await git.stash( pkgdir );
			await git.checkout( pkgdir, { branch: targetBranchName } );
			await git.pull( pkgdir );
			await git.stashPop( pkgdir, stashName );	
			return true;
		}
	}
	return false;
}

async function stashAndPull( pkgdir ) {
	const changed = !await git.isUpToDate( pkgdir );
	// repo is the same - do an update
	const stashName = await git.stash( pkgdir );
	await git.pull( pkgdir );
	await git.stashPop( pkgdir, stashName );
	return changed;
}

/**
 * When a repo is cloned, it is named a random UUID instead of the final folder name, so it can be checked for conflicts before commiting.
 * This class manages that
 *
 */
class RepoCloneCache {
	constructor( options ) {
		this._options = options;

		this._rootFlavioJson = null;
		this._lockedDirs = new Set(); // packages directories that can not be switched
	}
	
	async init( rootFlavioJson ) {
		this._rootFlavioJson = rootFlavioJson;
	}
	
	async add( name, module, options = {} ) {
		const pkgdir = module.dir;
		let changed = false;
		const repoUrl = util.parseRepositoryUrl( module.repo );
		if ( !fs.existsSync( pkgdir ) ) {
			// fresh checkout
			await doFreshClone( name, module, options, repoUrl );
			changed = true;
		} else {
			let pullDone = false;
			const targetObj = await resolve.getTargetFromRepoUrl( module.repo, pkgdir );
			// check to see if the local branch still exists on the remote, reset if not
			if ( options['remote-reset'] !== false ) {
				if ( await checkRemoteResetRequired( targetObj, name, module, options, repoUrl ) ) {
					changed = true;
					pullDone = true;
				}
			}
			if ( !pullDone ) {
				const repoState = await util.hasRepoChanged( module.repo, pkgdir );
				if ( repoState === 'url' ) {
					// dir has already been used by different repo - conflict
					const repo = await handleConflict( this._options, name, module, this._rootFlavioJson );
					if ( repo !== module.repo ) {
						await changeRepo( pkgdir, repo, options );
						changed = true;
						await stashAndPull( pkgdir );
					} else {
						changed = await stashAndPull( pkgdir );
					}
				} else if ( repoState === 'target' ) {
					// branch / tag / commit is different on clone than in flavio.json, but repo is the same.
					if ( !this._lockedDirs.has( module.dir ) ) {
						// already existing version has not been used already, use that cloned repo to do a switch
						if ( options.switch ) {
							const stashName = await git.stash( pkgdir );
							await git.pull( pkgdir );
							if ( targetObj.tag || targetObj.commit || ( targetObj.branch && await git.doesRemoteBranchExist( repoUrl.url, targetObj.branch ) ) ) {
								if ( !options.json ) {
									console.log( util.formatConsoleDependencyName( name ), `Switching to ${targetObj.tag || targetObj.commit || targetObj.branch}` );
								}
								await git.checkout( pkgdir, targetObj );
								await git.pull( pkgdir );
								changed = true;
							}
							await git.stashPop( pkgdir, stashName );
						} else {
							changed = await stashAndPull( pkgdir );
						}
					} else {
						if ( options.switch ) {
							// dir has already been used by a different branch - conflict
							const repo = await handleConflict( this._options, name, module, this._rootFlavioJson );
							if ( repo !== module.repo ) {
								await changeRepo( pkgdir, repo );
								changed = true;
								await stashAndPull( pkgdir );
							} else {
								changed = await stashAndPull( pkgdir );
							}
						} else {
							// switch option not specified - just do normal update
							changed = await stashAndPull( pkgdir );
						}
					}
				} else {
					// repo is the same - do a plain update
					changed = await stashAndPull( pkgdir );
				}
			}
		}
		if ( !this._lockedDirs.has( module.dir ) ) {
			this._lockedDirs.add( module.dir );
		}
		return {
			dir: pkgdir,
			changed
		};
	}
}


export default RepoCloneCache;
