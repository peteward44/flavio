import _ from 'lodash';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import * as util from '../core/util.js';
import handleConflict from '../core/handleConflict.js';
import { clone, checkAndSwitch, checkRemoteResetRequired } from '../core/dependencies.js';
import { getTargetFromRepoUrl } from '../core/resolve.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import checkForConflicts from '../core/checkForConflicts.js';
import GitRepositorySnapshot from '../core/GitRepositorySnapshot.js';
import getStatus from '../core/getStatus.js';
import logger from '../core/logger.js';

async function stashAndPull( snapshot, pkgdir, options, propagateErrors = false ) {
	const changed = !await snapshot.isUpToDate();
	if ( !changed ) {
		return false;
	}
	// repo is the same - do an update
	const stashName = await snapshot.stash();
	try {
		await snapshot.pull();
	} catch ( err ) {
		if ( propagateErrors ) {
			throw err;
		}
	}
	await snapshot.stashPop( stashName );
	return changed;
}

async function updateMainProject( options, snapshot ) {
	const target = await snapshot.getTarget();
	if ( !target.branch ) {
		if ( !options.json ) {
			logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Skipping update as not on a branch` );
		}
		return false;
	}
	let changed = false;
	if ( !options.json ) {
		logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Updating...` );
	}
	const stashName = await snapshot.stash();
	if ( !await snapshot.isUpToDate() ) {
		changed = true;
	}
	try {
		await snapshot.pull();
	} catch ( err ) {
		logger.error( `${util.formatConsoleDependencyName( snapshot.name, true )} Main project pull failed, does your branch exist on the remote?` );
	}
	await snapshot.stashPop( stashName );
	// if ( !options.json ) {
		// let targetName;
		// try {
			// targetName = target.tag || target.commit || target.branch;
		// } catch ( err ) {
		// }
		// logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Complete`, targetName ? `[${chalk.magenta(targetName)}]` : ``, changed ? `[${chalk.yellow( 'changes detected' )}]` : `` );
	// }
	return changed;
}

async function cloneMissingDependencies( snapshot, options ) {
	let keepGoing = true;
	while ( keepGoing ) {
		keepGoing = false;
		for ( const depInfo of snapshot.deps.values() ) {
			if ( await depInfo.snapshot.getStatus() === 'missing' ) {
				if ( !options.json ) {
					logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `Repository missing, performing fresh clone...` );
				}

				// update snapshot for new repo, and any dependencies it might have
				depInfo.snapshot = await GitRepositorySnapshot.fromName( depInfo.snapshot.name );

				// TODO: sort refs / deal with multiple ref conflicts
				const repoUrl = util.parseRepositoryUrl( depInfo.refs[0] );
				
				await clone( depInfo.snapshot.dir, options, repoUrl, options.link, depInfo.snapshot );
				
				await getSnapshot.walk( snapshot.deps, depInfo.snapshot );
				keepGoing = true;
				break;
			}
		}
	}
}

/**
 * Executes update on given directory
 *
 * @param {Object} options - Command line options
 * @param {string} options.cwd - Working directory
 * @param {boolean} [options.force-latest=false] - Force latest version on conflict
 */
async function update( options ) {
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	await globalConfig.init( options.cwd );
	util.defaultOptions( options );
	
	const initialSnapshot = await getSnapshot.getSnapshot( options.cwd );

	// make sure there are no conflicts in any dependencies before doing update
	const conflicts = await checkForConflicts( initialSnapshot, initialSnapshot.main );
	if ( conflicts.length > 0 ) {
		for ( const ss of conflicts ) {
			logger.log( 'error', `${util.formatConsoleDependencyName( ss.name )} Git conflict detected` );
		}
		const conflictString = `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} detected`;
		logger.log( 'error', `${chalk.red( conflictString )} aborting update` );
		return;
	}
	await updateMainProject( options, initialSnapshot.main );	

	if (options['ignore-dependencies']) {
		return;
	}
	
	// re-read config file in case the .flaviorc has changed
	await globalConfig.init( options.cwd );

	let snapshot = await getSnapshot.getSnapshot( options.cwd );

	// keep listing children until we have no more missing modules	
	await cloneMissingDependencies( snapshot, options );
	
	// this module list may contain multiple versions of the same repo.
	// resolve all conflicts
	const rootFlavioJson = await snapshot.main.getFlavioJson();
	for ( const depInfo of snapshot.deps.values() ) {
		if ( depInfo.refs.length > 1 ) {
			const module = await handleConflict( options, depInfo.snapshot.name, depInfo.refs, rootFlavioJson );
			
			if ( !fs.existsSync( path.join( depInfo.snapshot.dir, '.git' ) ) ) {
				const repoUrl = util.parseRepositoryUrl( module );
				await clone( depInfo.snapshot.dir, options, repoUrl, options.link, depInfo.snapshot );
			} else {
				await checkAndSwitch( depInfo.snapshot, options, depInfo.snapshot.dir, module );
			}
		}
	}
	// now make sure all modules point to the right bits
	let hadChanges = false;
	do {
		hadChanges = false;
		for ( const depInfo of snapshot.deps.values() ) {
			const { changeID } = depInfo.snapshot;
			const module = depInfo.refs[0];
			if ( await depInfo.snapshot.getStatus() === 'installed' ) {
				const flavioDependencies = await depInfo.snapshot.getDependencies();
				if ( !options.json ) {
					logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `Updating...` );
				}
				let targetObj = null;
				try {
					targetObj = await getTargetFromRepoUrl( depInfo.snapshot, module, depInfo.snapshot.dir );
				} catch ( err ) {
					// desired branch / tag does not exist - fall back to master
					targetObj = { branch: 'master' };
				}
				// check to see if the local branch still exists on the remote, reset if not
				if ( options['remote-reset'] !== false ) {
					const repoUrl = util.parseRepositoryUrl( module );
					await checkRemoteResetRequired( depInfo.snapshot, targetObj, depInfo.snapshot.name, depInfo.snapshot.dir, options, repoUrl );
				}
				if ( options.switch ) {
					await checkAndSwitch( depInfo.snapshot, options, depInfo.snapshot.dir, module );
				}
				try {
					await stashAndPull( depInfo.snapshot, depInfo.snapshot.dir, options, true );
				} catch ( err ) {
					// On a repo that looks like everything should work fine but doesn't, the repo has probably been recreated.
					// if the repo is clean, hard reset and pull.
					const errout = await depInfo.snapshot.pullCaptureError();
					if ( errout === 'fatal: refusing to merge unrelated histories' ) {
						if ( await depInfo.snapshot.isWorkingCopyClean() ) {
							logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `Unrelated histories detected, performing hard reset...` );
							await depInfo.snapshot.fixUnrelatedHistory( targetObj );
						} else {
							logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `Unrelated histories detected, but cannot reset due to local changes!` );
						}
					} else {
						throw err;
					}
				}
				// if ( !options.json ) {
					// logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Complete`, targetName ? `[${chalk.magenta(targetName)}]` : ``, changed ? `[${chalk.yellow( 'changes detected' )}]` : `` );
				// }
				if ( changeID !== depInfo.snapshot.changeID ) {
					hadChanges = true;
					break;
				}
				const newDependencies = await depInfo.snapshot.getDependencies();
				if ( !hadChanges && JSON.stringify( flavioDependencies ) !== JSON.stringify( newDependencies ) ) {
					hadChanges = true;
					break;
				}
			}
		}
		if ( hadChanges ) {
			// rebuild snapshot dependency map if it's changed
			snapshot = await getSnapshot.getSnapshot( snapshot.main.dir, snapshot );
		}
	} while ( hadChanges );

	if ( !options.json ) {
		const status = await getStatus( options, snapshot, {
			changed: true
		} );
		console.log( status );
	}
}

export default update;
