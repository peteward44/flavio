import _ from 'lodash';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import * as util from './util.js';
import * as git from './git.js';
import handleConflict from './handleConflict.js';
import { clone, checkAndSwitch, checkRemoteResetRequired } from './dependencies.js';
import { getTargetFromRepoUrl } from './resolve.js';
import DependencyStatusMap from './DependencyStatusMap.js';
import globalConfig from './globalConfig.js';
import * as getSnapshot from './getSnapshot.js';
import GitRepositorySnapshot from './GitRepositorySnapshot.js';

async function checkForConflicts( snapshot ) {
	let conflicts = [];
	if ( await snapshot.main.isConflicted() ) {
		conflicts.push( snapshot.main );
	}
	for ( const depInfo of snapshot.deps.values() ) {
		if ( await depInfo.snapshot.isConflicted() ) {
			conflicts.push( depInfo.snapshot );
		}
	}
	return conflicts;
}

async function stashAndPull( snapshot, pkgdir, options, propagateErrors = false ) {
	const changed = !await snapshot.isUpToDate();
	if ( !changed ) {
		return false;
	}
	// repo is the same - do an update
	const stashName = await snapshot.stash();
	try {
		await snapshot.pull( pkgdir );
	} catch ( err ) {
		console.error( `Error executing pull on repository` );
		console.error( err.message || err );
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
			console.log( util.formatConsoleDependencyName( snapshot.name ), `Skipping update as not on a branch` );
		}
		return false;
	}
	let changed = false;
	if ( !options.json ) {
		console.log( util.formatConsoleDependencyName( snapshot.name ), `Updating...` );
	}
	const stashName = await snapshot.stash();
	if ( !await snapshot.isUpToDate() ) {
		changed = true;
	}
	try {
		await snapshot.pull();
	} catch ( err ) {
		console.error( util.formatConsoleDependencyName( snapshot.name, true ), `Main project pull failed, does your branch exist on the remote?` );
	}
	await snapshot.stashPop( stashName );
	if ( !options.json ) {
		let targetName;
		try {
			targetName = target.tag || target.commit || target.branch;
		} catch ( err ) {
		}
		console.log( util.formatConsoleDependencyName( snapshot.name ), `Complete`, targetName ? `[${chalk.magenta(targetName)}]` : ``, changed ? `[${chalk.yellow( 'changes detected' )}]` : `` );
	}
	return changed;
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
	await util.readConfigFile( options.cwd );
	
	const initialSnapshot = await getSnapshot.getSnapshot( options.cwd );

	const depStatusMap = new DependencyStatusMap();

	// make sure there are no conflicts in any dependencies before doing update
	const conflicts = await checkForConflicts( initialSnapshot );
	if ( conflicts.length > 0 ) {
		for ( const ss of conflicts ) {
			console.error( util.formatConsoleDependencyName( ss.name ), `Git conflict detected` );
		}
		console.error( chalk.red( `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} detected` ), `aborting update` );
		return;
	}
	
	if ( !options.fromCloneCommand ) {
		if ( await updateMainProject( options, initialSnapshot.main ) ) {
			depStatusMap.markChanged( 'main' );
		}
	} else {
		// Called from the 'clone' command - Automatically increment update/change count to account for main project
		depStatusMap.markChanged( 'main' );
	}
	depStatusMap.markUpToDate( 'main' );
	
	if (options['ignore-dependencies']) {
		return;
	}
	
	// re-read config file in case the .flaviorc has changed
	await util.readConfigFile( options.cwd );
	await globalConfig.init( options.cwd );

	const snapshot = await getSnapshot.getSnapshot( options.cwd );

	// keep listing children until we have no more missing modules
	let missingCount = 0;
	do {
		missingCount = 0;
		for ( const depInfo of snapshot.deps.values() ) {
			depStatusMap.markInspected( depInfo.snapshot.name );
			if ( await depInfo.snapshot.getStatus() === 'missing' ) {
				missingCount++;
				if ( !options.json ) {
					console.log( util.formatConsoleDependencyName( depInfo.snapshot.name ), `Repository missing, performing fresh clone...` );
				}
				// TODO: sort refs / deal with multiple ref conflicts
				const repoUrl = util.parseRepositoryUrl( depInfo.refs[0] );
				if ( await clone( depInfo.snapshot.dir, options, repoUrl, options.link ) ) {
					depStatusMap.markUpToDate( depInfo.snapshot.name );
				}
				depStatusMap.markChanged( depInfo.snapshot.name );
				
				// update snapshot for new repo, and any dependencies it might have
				depInfo.snapshot = await GitRepositorySnapshot.fromName( depInfo.snapshot.name );
				await getSnapshot.walk( snapshot.deps, depInfo.snapshot );
				break;
			}
		}
	} while ( missingCount > 0 );

	// this module list may contain multiple versions of the same repo.
	// resolve all conflicts
	const rootFlavioJson = await snapshot.main.getFlavioJson();
	for ( const depInfo of snapshot.deps.values() ) {
		if ( depInfo.refs.length > 1 ) {
			const module = await handleConflict( options, depInfo.snapshot.name, depInfo.refs, rootFlavioJson );
			
			if ( !fs.existsSync( path.join( depInfo.snapshot.dir, '.git' ) ) ) {
				const repoUrl = util.parseRepositoryUrl( module );
				if ( await clone( depInfo.snapshot.dir, options, repoUrl, options.link ) ) {
					depStatusMap.markUpToDate( depInfo.snapshot.name );
				}
				depStatusMap.markChanged( depInfo.snapshot.name );
			} else {
				if ( !depStatusMap.isUpToDate( depInfo.snapshot.name ) ) {
					const status = await checkAndSwitch( depInfo.snapshot, options, depInfo.snapshot.dir, module );
					switch ( status ) {
						default:
						case 'none':
							break;
						case 'clone':
							depStatusMap.markChanged( depInfo.snapshot.name );
							depStatusMap.markUpToDate( depInfo.snapshot.name );
							break;
						case 'switch':
							depStatusMap.markChanged( depInfo.snapshot.name );
							break;
					}
				}
			}
		}
	}
	// now make sure all modules point to the right bits
	for ( const depInfo of snapshot.deps.values() ) {
		const module = depInfo.refs[0];
		switch ( await depInfo.snapshot.getStatus() ) {
			default:
				break;
			case 'installed':
			{
				depStatusMap.markInspected( depInfo.snapshot.name );
				if ( !depStatusMap.isUpToDate( depInfo.snapshot.name ) ) {
					if ( !options.json ) {
						console.log( util.formatConsoleDependencyName( depInfo.snapshot.name ), `Updating...` );
					}
					const targetObj = await getTargetFromRepoUrl( depInfo.snapshot, module, depInfo.snapshot.dir );
					// check to see if the local branch still exists on the remote, reset if not
					if ( options['remote-reset'] !== false ) {
						const repoUrl = util.parseRepositoryUrl( module );
						const status = await checkRemoteResetRequired( depInfo.snapshot, targetObj, depInfo.snapshot.name, depInfo.snapshot.dir, options, repoUrl );
						switch ( status ) {
							default:
							case 'none':
								break;
							case 'clone':
								depStatusMap.markChanged( depInfo.snapshot.name );
								depStatusMap.markUpToDate( depInfo.snapshot.name );
								break;
							case 'switch':
								depStatusMap.markChanged( depInfo.snapshot.name );
								break;
						}
					}
					if ( options.switch ) {
						const status = await checkAndSwitch( depInfo.snapshot, options, depInfo.snapshot.dir, module );
						switch ( status ) {
							default:
							case 'none':
								break;
							case 'clone':
								depStatusMap.markChanged( depInfo.snapshot.name );
								depStatusMap.markUpToDate( depInfo.snapshot.name );
								break;
							case 'switch':
								depStatusMap.markChanged( depInfo.snapshot.name );
								break;
						}
					}
					try {
						if ( await stashAndPull( depInfo.snapshot, depInfo.snapshot.dir, options, true ) ) {
							depStatusMap.markChanged( depInfo.snapshot.name );
						}
					} catch ( err ) {
						// On a repo that looks like everything should work fine but doesn't, the repo has probably been recreated.
						// if the repo is clean, hard reset and pull.
						const pkgdir = depInfo.snapshot.dir;
						const errout = ( await git.pull( pkgdir, {
							captureStderr: true, captureStdout: true, ignoreError: true, depth: options.depth 
						} ) ).err.trim();
						if ( errout === 'fatal: refusing to merge unrelated histories' ) {
							if ( await git.isWorkingCopyClean( pkgdir ) ) {
								console.log( util.formatConsoleDependencyName( depInfo.snapshot.name ), `Unrelated histories detected, performing hard reset...` );
								try {
									await git.fetch( pkgdir, ['--all'] );
								} catch ( err2 ) {
									console.error( `Error executing fetch on repository` );
									console.error( err2.message || err2 );
								}
								await git.executeGit( ['reset', '--hard', `origin/${targetObj.tag || targetObj.commit || targetObj.branch}`], { cwd: pkgdir } );
								try {
									await git.pull( pkgdir, { depth: options.depth } );
								} catch ( err2 ) {
									console.error( `Error executing pull on repository` );
									console.error( err2.message || err2 );
								}
								depStatusMap.markChanged( depInfo.snapshot.name );
								depStatusMap.markUpToDate( depInfo.snapshot.name );
							} else {
								console.log( util.formatConsoleDependencyName( depInfo.snapshot.name ), `Unrelated histories detected, but cannot reset due to local changes!` );
							}
						} else {
							throw err;
						}
					}
				}
				break;
			}
		}
	}

	if ( !options.json ) {
		const updateCount = depStatusMap.inspectedCount();
		const changeCount = depStatusMap.changedCount();
		console.log( chalk.yellow( `${updateCount}` ), `${updateCount === 1 ? 'repository' : 'repositories'} inspected,`, chalk.yellow( `${changeCount}` ), `changed` );
	}
}

export default update;
