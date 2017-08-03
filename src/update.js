import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';
import * as resolve from './resolve.js';
import RepoCloneCache from './RepoCloneCache.js';

/**
 * Loads the flavio.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
function loadflavioJson( cwd ) {
	const p = path.join( cwd, util.getflavioJsonFileName() );
	return new Promise( (resolv, reject) => {
		fs.readFile( p, 'utf8', (err, txt) => {
			err ? resolv( '{}' ) : resolv( txt );
		} );
	} )
	.then( (txt) => {
		return JSON.parse( txt.toString() );
	} );
}

async function updateProject( dir, repo = null ) {
	const stashName = await git.stash( dir );
	await git.pull( dir );
	
	if ( repo ) {
		const repoUrl = util.parseRepositoryUrl( repo );
		const localUrl = await git.getWorkingCopyUrl( dir, true );
		if ( localUrl !== repoUrl.url ) {
			// Repository URL has changed - throw error
			throw new Error( `Repository url for repo ${path.basename( dir )} has changed! Aborting operation...` );
		}
		const targetObj = await resolve.getTargetFromRepoUrl( repo, dir );
		const targetCur = await git.getCurrentTarget( dir );
		const targetChanged = targetObj.branch !== targetCur.branch || targetObj.tag !== targetCur.tag;
		const validTarget = targetObj.branch || targetObj.tag;
		if ( targetChanged && validTarget ) {
			console.log( `Switching package ${name} to ${validTarget}` );
			await git.checkout( dir, targetObj );
			console.log( `Complete` );
		}
	}
	await git.stashPop( dir, stashName );
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
	// update main project first
	console.log( `Updating main project...` );
	await updateProject( options.cwd );
	console.log( `Complete` );
	await util.readConfigFile( options.cwd );
	
	let repoCache = new RepoCloneCache( options );
	await repoCache.init( await loadflavioJson( options.cwd ) );

	// get current tree
	let tree = await depTree.calculate( options, repoCache );
	
	console.log( JSON.stringify( tree, null, 2 ) );
	
}

export default update;
