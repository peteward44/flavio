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
	await util.readConfigFile( options.cwd );
	// update main project first
	let updateResult = {
		changed: false
	};
	if ( !options.json ) {
		console.log( `Updating main project...` );
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
