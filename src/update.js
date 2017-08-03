import _ from 'lodash';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';
import RepoCloneCache from './RepoCloneCache.js';

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
	const stashName = await git.stash( options.cwd );
	await git.pull( options.cwd );
	await git.stashPop( options.cwd, stashName );
	console.log( `Complete` );
	await util.readConfigFile( options.cwd );
	
	let repoCache = new RepoCloneCache( options );
	await repoCache.init( await util.loadFlavioJson( options.cwd ) );

	// traverse tree, checking out / updating modules as we go
	await depTree.traverse( options, ( name, childModule ) => repoCache.add( name, childModule ) );
}

export default update;
