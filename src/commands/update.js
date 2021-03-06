import _ from 'lodash';
import chalk from 'chalk';
import * as util from '../core/util.js';
import { clone, checkAndSwitch, checkRemoteResetRequired } from '../core/dependencies.js';
import { getTargetFromRepoUrl } from '../core/resolve.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import checkForConflicts from '../core/checkForConflicts.js';
import GitRepositorySnapshot from '../core/GitRepositorySnapshot.js';
import snapshotPool from '../core/snapshotPool.js';
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
	if ( await snapshot.getStatus() !== 'installed' ) {
		// root project is not a git repository, just continue
		return;
	}
	if ( !options.json ) {
		logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Updating...` );
	}
	const stashName = await snapshot.stash();
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
}

async function processDependency( options, snapshot, ref ) {
	if ( !options.json ) {
		logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Updating...` );
	}

	// clone new repository if it's missing
	if ( await snapshot.getStatus() === 'missing' ) {
		if ( !options.json ) {
			logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Repository missing, performing fresh clone...` );
		}
		const repoUrl = util.parseRepositoryUrl( ref );
		await clone( snapshot.dir, options, repoUrl, options.link, snapshot );
	}

	const url = await snapshot.getBareUrl();
	const { url: rurl } = util.parseRepositoryUrl( ref );	
	if ( url.toLowerCase() !== rurl.toLowerCase() ) {
		logger.log( "warn", `[${snapshot.name}] Repository URL "${url}" does not match dependency reference "${rurl}"` );
	}

	let targetObj = null;
	try {
		targetObj = await getTargetFromRepoUrl( snapshot, ref, snapshot.dir );
	} catch ( err ) {
	}
	if ( !targetObj ) {
		// desired branch / tag does not exist - fall back to master
		targetObj = { branch: 'master' };
	}

	// check to see if the local branch still exists on the remote, reset if not
	if ( options['remote-reset'] !== false ) {
		const repoUrl = util.parseRepositoryUrl( ref );
		await checkRemoteResetRequired( snapshot, targetObj, snapshot.name, snapshot.dir, options, repoUrl );
	}
	if ( options.switch ) {
		await checkAndSwitch( snapshot, options, snapshot.dir, ref );
	}
	try {
		await stashAndPull( snapshot, snapshot.dir, options, true );
	} catch ( err ) {
		// On a repo that looks like everything should work fine but doesn't, the repo has probably been recreated.
		// if the repo is clean, hard reset and pull.
		const errout = await snapshot.pullCaptureError();
		if ( errout === 'fatal: refusing to merge unrelated histories' ) {
			if ( await snapshot.isWorkingCopyClean() ) {
				logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Unrelated histories detected, performing hard reset...` );
				await snapshot.fixUnrelatedHistory( targetObj );
			} else {
				logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Unrelated histories detected, but cannot reset due to local changes!` );
			}
		} else {
			throw err;
		}
	}
}

async function iterateDeps( options, snapshot ) {
	const deps = await snapshot.getDependencies();
	for ( const name of Object.keys( deps ) ) {
		const ref = deps[name];
		const childSnapshot = await snapshotPool.fromName( name, ref );
		await processDependency( options, childSnapshot, ref );
		await iterateDeps( options, childSnapshot );
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
	if ( !options.fromCloneCommand ) {
		await updateMainProject( options, initialSnapshot.main );	
	}
	
	if (options['ignore-dependencies']) {
		return;
	}
	
	// re-read config file in case the .flaviorc has changed
	await globalConfig.init( options.cwd );
	
	// Iterate over all dependencies
	await iterateDeps( options, await GitRepositorySnapshot.fromDir( options.cwd ) );
	
	if ( !options.json ) {
		//snapshotPool.clearAll();
		const statusSnapshot = await getSnapshot.getSnapshot( options.cwd );
		const status = await getStatus( { ...options, nofetch: true }, statusSnapshot, {
			changed: !options.fromCloneCommand
		} );
		console.log( status );
	}
}

export default update;
