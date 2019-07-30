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
		await git.clone( repoUrl.url, pkgdir, { branch: repoUrl.target || 'master', depth: options.depth } );
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
	await git.clone( repoUrl.url, pkgdir, { branch: repoUrl.target || 'master', depth: options.depth } );
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
			await git.pull( pkgdir, { depth: options.depth } );
			await git.stashPop( pkgdir, stashName );	
			return true;
		}
	}
	return false;
}

async function stashAndPull( pkgdir, options ) {
	const changed = !await git.isUpToDate( pkgdir );
	// repo is the same - do an update
	const stashName = await git.stash( pkgdir );
	await git.pull( pkgdir, { depth: options.depth } );
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
				try {
					if ( repoState === 'url' ) {
						// dir has already been used by different repo - conflict
						const repo = await handleConflict( this._options, name, module, this._rootFlavioJson );
						if ( repo !== module.repo ) {
							await changeRepo( pkgdir, repo, options );
							changed = true;
							await stashAndPull( pkgdir, options );
						} else {
							changed = await stashAndPull( pkgdir, options );
						}
					} else if ( repoState === 'target' ) {
						// branch / tag / commit is different on clone than in flavio.json, but repo is the same.
						if ( !this._lockedDirs.has( module.dir ) ) {
							// already existing version has not been used already, use that cloned repo to do a switch
							if ( options.switch ) {
								const stashName = await git.stash( pkgdir );
								await git.pull( pkgdir, { depth: options.depth } );
								if ( targetObj.tag || targetObj.commit || ( targetObj.branch && await git.doesRemoteBranchExist( repoUrl.url, targetObj.branch ) ) ) {
									if ( !options.json ) {
										console.log( util.formatConsoleDependencyName( name ), `Switching to ${targetObj.tag || targetObj.commit || targetObj.branch}` );
									}
									await git.checkout( pkgdir, targetObj );
									await git.pull( pkgdir, { depth: options.depth } );
									changed = true;
								}
								await git.stashPop( pkgdir, stashName );
							} else {
								changed = await stashAndPull( pkgdir, options );
							}
						} else {
							if ( options.switch ) {
								// dir has already been used by a different branch - conflict
								const repo = await handleConflict( this._options, name, module, this._rootFlavioJson );
								if ( repo !== module.repo ) {
									await changeRepo( pkgdir, repo );
									changed = true;
									await stashAndPull( pkgdir, options );
								} else {
									changed = await stashAndPull( pkgdir, options );
								}
							} else {
								// switch option not specified - just do normal update
								changed = await stashAndPull( pkgdir, options );
							}
						}
					} else {
						// repo is the same - do a plain update
						changed = await stashAndPull( pkgdir, options );
					}
				} catch ( err ) {
					// On a repo that looks like everything should work fine but doesn't, the repo has probably been recreated.
					// if the repo is clean, hard reset and pull.
					const errout = ( await git.pull( pkgdir, {
						captureStderr: true, captureStdout: true, ignoreError: true, depth: options.depth 
					} ) ).err.trim();
					if ( errout === 'fatal: refusing to merge unrelated histories' ) {
						if ( await git.isWorkingCopyClean( pkgdir ) ) {
							changed = true;
							console.log( util.formatConsoleDependencyName( name ), `Unrelated histories detected, performing hard reset...` );
							await git.fetch( pkgdir, ['--all'] );
							await git.executeGit( ['reset', '--hard', `origin/${targetObj.tag || targetObj.commit || targetObj.branch}`], { cwd: pkgdir } );
							await git.pull( pkgdir, { depth: options.depth } );
						} else {
							console.log( util.formatConsoleDependencyName( name ), `Unrelated histories detected, but cannot reset due to local changes!` );
						}
					}
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
