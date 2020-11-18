import _ from 'lodash';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';
import checkForConflicts from './checkForConflicts.js';
import handleConflict from './handleConflict.js';
import { clone, checkAndSwitch, checkRemoteResetRequired } from './dependencies.js';
import { getTargetFromRepoUrl } from './resolve.js';


async function stashAndPull( pkgdir, options ) {
	const changed = !await git.isUpToDate( pkgdir );
	// repo is the same - do an update
	const stashName = await git.stash( pkgdir );
	await git.pull( pkgdir, { depth: options.depth } );
	await git.stashPop( pkgdir, stashName );
	return changed;
}


async function updateMainProject( options ) {
	util.defaultOptions( options );
	let changed = false;
	// update main project first
	// get name of main project if flavio.json exists
	const mainProjectName = await util.getMainProjectName( options.cwd );
	
	if ( !options.json ) {
		console.log( util.formatConsoleDependencyName( mainProjectName ), `Updating...` );
	}
	const stashName = await git.stash( options.cwd );
	if ( !await git.isUpToDate( options.cwd ) ) {
		changed = true;
	}
	try {
		await git.pull( options.cwd, { depth: options.depth } );
	} catch ( err ) {
		console.error( util.formatConsoleDependencyName( mainProjectName, true ), `Main project pull failed, does your branch exist on the remote?` );
	}
	await git.stashPop( options.cwd, stashName );
	if ( !options.json ) {
		let targetName;
		try {
			const target = await git.getCurrentTarget( options.cwd );
			targetName = target.tag || target.commit || target.branch;
		} catch ( err ) {
		}
		console.log( util.formatConsoleDependencyName( mainProjectName ), `Complete`, targetName ? `[${chalk.magenta(targetName)}]` : ``, changed ? `[${chalk.yellow( 'changes detected' )}]` : `` );
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
	await util.readConfigFile( options.cwd );

	let updateCount = 0;
	let changeCount = 0;
	let updateResult = {
		changed: false
	};

	// make sure there are no conflicts in any dependencies before doing update
	const isConflicted = await checkForConflicts( options );
	if ( isConflicted ) {
		console.error( chalk.red( `Conflicts detected` ), `aborting update` );
		return;
	}

	if ( !options.fromCloneCommand ) {
		updateCount++;
		if ( await updateMainProject( options ) ) {
			updateResult.changed = true;
			changeCount++;
		}
	} else {
		// Called from the 'clone' command - Automatically increment update/change count to account for main project
		updateResult.changed = true;
		updateCount++;
		changeCount++;
	}
	
	// re-read config file in case the .flaviorc has changed
	await util.readConfigFile( options.cwd );
	
	// keep listing children until we have no more missing modules
	let missingCount = 0;
	do {
		missingCount = 0;
		const modules = await depTree.listChildren( options );
		for ( const moduleArray of modules.values() ) {
			const module = moduleArray[0];
			switch ( module.status ) {
				case 'missing':
					if ( !fs.existsSync( path.join( module.dir, '.git' ) ) ) {
						if ( !options.json ) {
							console.log( util.formatConsoleDependencyName( module.name ), `Repository missing, performing fresh clone...` );
						}
						const repoUrl = util.parseRepositoryUrl( module.repo );
						await clone( module.dir, options, repoUrl, options.link );
						missingCount++;
					}
					break;
				default:
					break;
			}
		}
	} while ( missingCount > 0 );

	const modules = await depTree.listChildren( options );
	// this module list may contain multiple versions of the same repo.
	// resolve all conflicts
	const rootFlavioJson = await util.loadFlavioJson( options.cwd );
	for ( const [name, modulesArray] of modules.entries() ) {
		if ( modulesArray.length > 1 ) {
			const module = await handleConflict( options, name, modulesArray, rootFlavioJson );
			modules.set( module.name, [module] );
			if ( !fs.existsSync( path.join( module.dir, '.git' ) ) ) {
				const repoUrl = util.parseRepositoryUrl( module.repo );
				await clone( module.dir, options, repoUrl, options.link );
			} else {
				await checkAndSwitch( options, module.dir, module.repo );
			}
		}
	}
	// now make sure all modules point to the right bits
	for ( const modulesArray of modules.values() ) {
		const module = modulesArray[0];
		switch ( module.status ) {
			default:
				break;
			case 'installed':
			{
				if ( !options.json ) {
					console.log( util.formatConsoleDependencyName( module.name ), `Updating...` );
				}
				const targetObj = await getTargetFromRepoUrl( module.repo, module.dir );
				// check to see if the local branch still exists on the remote, reset if not
				if ( options['remote-reset'] !== false ) {
					const repoUrl = util.parseRepositoryUrl( module.repo );
					if ( await checkRemoteResetRequired( targetObj, module.name, module, options, repoUrl ) ) {
						break;
					}
				}
				if ( options.switch ) {
					await checkAndSwitch( options, module.dir, module.repo );
				}
				try {
					await stashAndPull( module.dir, options );
				} catch ( err ) {
					// On a repo that looks like everything should work fine but doesn't, the repo has probably been recreated.
					// if the repo is clean, hard reset and pull.
					const pkgdir = module.dir;
					const errout = ( await git.pull( pkgdir, {
						captureStderr: true, captureStdout: true, ignoreError: true, depth: options.depth 
					} ) ).err.trim();
					if ( errout === 'fatal: refusing to merge unrelated histories' ) {
						if ( await git.isWorkingCopyClean( pkgdir ) ) {
							console.log( util.formatConsoleDependencyName( module.name ), `Unrelated histories detected, performing hard reset...` );
							await git.fetch( pkgdir, ['--all'] );
							await git.executeGit( ['reset', '--hard', `origin/${targetObj.tag || targetObj.commit || targetObj.branch}`], { cwd: pkgdir } );
							await git.pull( pkgdir, { depth: options.depth } );
						} else {
							console.log( util.formatConsoleDependencyName( module.name ), `Unrelated histories detected, but cannot reset due to local changes!` );
						}
					} else {
						throw err;
					}
				}
				break;
			}
		}
	}

	if ( options.json ) {
		console.log( JSON.stringify( updateResult, null, 2 ) );
	} else {
		console.log( chalk.yellow( `${updateCount}` ), `${updateCount === 1 ? 'repository' : 'repositories'} inspected,`, chalk.yellow( `${changeCount}` ), `changed` );
	}
}

export default update;
