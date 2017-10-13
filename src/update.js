import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';
import RepoCloneCache from './RepoCloneCache.js';

async function checkConflicted( options ) {
	if ( fs.existsSync( path.join( options.cwd, '.git' ) ) && await git.isConflicted( options.cwd ) ) {
		console.log( `Main project has conflicts` );
		return true;
	}
	let conflicts = false;
	await depTree.traverse( options, async ( name, childModule ) => {
		if ( fs.existsSync( path.join( childModule.dir, '.git' ) ) && await git.isConflicted( childModule.dir ) ) {
			console.log( util.formatConsoleDependencyName( childModule.name, true ), `Conflicts detected` );
			conflicts = true;
		}
	} );
	return conflicts;
}

async function updateMainProject( options ) {
	let changed = false;
	// update main project first
	// get name of main project if flavio.json exists
	let mainProjectName = 'main';
	const mainFlavioJsonPath = path.join( options.cwd, await util.getflavioJsonFileName() );
	if ( fs.existsSync( mainFlavioJsonPath ) ) {
		const mainFlavioJson = JSON.parse( fs.readFileSync( mainFlavioJsonPath, 'utf8' ) );
		if ( _.isString( mainFlavioJson.name ) && mainFlavioJson.name.length > 0 ) {
			mainProjectName = mainFlavioJson.name;
		}
	}
	
	if ( !options.json ) {
		console.log( util.formatConsoleDependencyName( mainProjectName ), `Updating...` );
	}
	const stashName = await git.stash( options.cwd );
	if ( !await git.isUpToDate( options.cwd ) ) {
		changed = true;
	}
	try {
		await git.pull( options.cwd );
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
		console.log( util.formatConsoleDependencyName( mainProjectName ), `Update complete`, targetName ? `[${chalk.magenta(targetName)}]` : ``, changed ? `[${chalk.yellow( 'changes detected' )}]` : `` );
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

	let updateCount = 1;
	let changeCount = 0;
	let updateResult = {
		changed: false
	};

	// make sure there are no conflicts in any dependencies before doing update
	const isConflicted = await checkConflicted( options );
	if ( isConflicted ) {
		console.error( chalk.red( `Conflicts detected` ), `aborting update` );
		return;
	}

	if ( await updateMainProject( options ) ) {
		updateResult.changed = true;
		changeCount++;
	}
	
	// re-read config file in case the .flaviorc has changed
	await util.readConfigFile( options.cwd );
	
	let repoCache = new RepoCloneCache( options );
	await repoCache.init( await util.loadFlavioJson( options.cwd ) );

	// traverse tree, checking out / updating modules as we go
	await depTree.traverse( options, async ( name, childModule ) => {
		if ( !options.json ) {
			console.log( util.formatConsoleDependencyName( name ), `Updating...` );
		}
		const addResult = await repoCache.add( name, childModule, options );
		if ( addResult.changed ) {
			updateResult.changed = true;
			changeCount++;
		}
		if ( !options.json ) {
			const target = await git.getCurrentTarget( childModule.dir );
			const targetName = target.tag || target.commit || target.branch;
			console.log( util.formatConsoleDependencyName( name ), `Update complete`, targetName ? `[${chalk.magenta(targetName)}]` : ``, addResult.changed ? `[${chalk.yellow( 'changes detected' )}]` : `` );
		}
		updateCount++;
		return addResult.dir;
	} );
	if ( options.json ) {
		console.log( JSON.stringify( updateResult, null, 2 ) );
	} else {
		console.log( chalk.yellow( `${updateCount}` ), `${updateCount === 1 ? 'repository' : 'repositories'} inspected,`, chalk.yellow( `${changeCount}` ), `changed` );
	}
}

export default update;
