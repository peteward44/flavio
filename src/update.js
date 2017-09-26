import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
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
			console.log( `${childModule.name} has conflicts` );
			conflicts = true;
		}
	} );
	return conflicts;
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
	// update main project first
	let updateResult = {
		changed: false
	};
	if ( !options.json ) {
		console.log( `Updating main project...` );
	}
	// make sure there are no conflicts in any dependencies before doing update
	const isConflicted = await checkConflicted( options );
	if ( isConflicted ) {
		console.log( `Conflicts detected, aborting update...` );
		return;
	}
	
	const stashName = await git.stash( options.cwd );
	if ( !await git.isUpToDate( options.cwd ) ) {
		updateResult.changed = true;
	}
	await git.pull( options.cwd );
	await git.stashPop( options.cwd, stashName );
	if ( !options.json ) {
		console.log( `Complete` );
	}
	
	let repoCache = new RepoCloneCache( options );
	await repoCache.init( await util.loadFlavioJson( options.cwd ) );

	// traverse tree, checking out / updating modules as we go
	await depTree.traverse( options, async ( name, childModule ) => {
		console.log( `Updating ${name}...` );
		if ( !updateResult.changed && !await git.isUpToDate( childModule.dir ) ) {
			updateResult.changed = true;
		}
		const newModule = await repoCache.add( name, childModule, options );
		console.log( `Complete` );
		return newModule;
	} );
	if ( options.json ) {
		console.log( JSON.stringify( updateResult, null, 2 ) );
	}
}

export default update;
