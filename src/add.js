import _ from 'lodash';
import * as util from './util.js';
import update from './update.js';

/**
 * Adds a repo to the flavio.json, then performs update afterwards
 *
 * @param {string} name - name of repo to put in flavio.json
 * @param {string} repo - repository paths in "bower format" to add to the project, or empty to install all dependencies inside flavio.json
 * @param {Object} options - Command line options
 * @param {string} options.cwd - Working directory
 * @param {boolean} [options.force-latest=false] - Force latest version on conflict
 */
async function add( name, repo, options ) {
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	
	console.log( `Adding ${name} : ${repo}` );
	
	const flavioJson = await util.loadFlavioJson( options.cwd );

	// // add new modules to the flavio.json
	if ( !_.isObject( flavioJson.dependencies ) ) {
		flavioJson.dependencies = {};
	}
	flavioJson.dependencies[name] = util.formatDefaultRepoPath( repo );

	await util.saveFlavioJson( options.cwd, flavioJson );	
	await update( options );
}

export default add;
