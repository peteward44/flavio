import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';
import * as resolve from './resolve.js';
import RepoCloneCache from './RepoCloneCache.js';

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
		const targetObj = await resolve.getTargetFromRepoUrl( repo );
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


async function updateOutofDate( children ) {
	for ( const [name, module] of children ) {
		console.log( `Updating ${name} [${module.repo}]...` );
		// check if the repo path resolves to a different target (ie. it was on a tag 0.1.0, but should now be 0.1.1).
		// If it is, switch over to that. Otherwise, just do a basic pull
		const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
		const targetCur = await git.getCurrentTarget( module.dir );
		const targetChanged = targetObj.branch !== targetCur.branch || targetObj.tag !== targetCur.tag;
		const validTarget = targetObj.branch || targetObj.tag;
		
		const stashName = await git.stash( module.dir );
		if ( targetChanged && validTarget ) {
			console.log( `Switching package ${name} to ${validTarget}` );
			await git.checkout( module.dir, targetObj );
		}
		await git.pull( module.dir );
		await git.stashPop( module.dir, stashName );
		// TODO: detect local change conflicts and report if any
		console.log( `Complete` );
		if ( module.children ) {
			await updateOutofDate( module.children );
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
	// update main project first
	console.log( `Updating main project...` );
	await updateProject( options.cwd );
	console.log( `Complete` );
	await util.readConfigFile( options.cwd );
	
	let repoCache = new RepoCloneCache( options );
	await repoCache.init();

	// get current tree
	let tree = await depTree.calculate( options, repoCache );
	
	await repoCache.resolveConflicts();
	
	
}

export default update;
