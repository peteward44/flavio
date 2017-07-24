import _ from 'lodash';
import path from 'path';
import fs from 'fs';

/**
 * Adds a repo to the flavio.json
 *
 * @param {Array.<string>|string} repos - Array of repository paths in "bower format" to add to the project, or empty to install all dependencies inside flavio.json
 * @param {Object} options - Command line options
 * @param {string} options.cwd - Working directory
 * @param {boolean} [options.force-latest=false] - Force latest version on conflict
 */
async function add(repos, options) {
	if ( !Array.isArray( repos ) ) {
		repos = [repos];
	}
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}

	// add new modules to the flavio.json
	if ( repos.length > 0 ) {
		let flavioJsonChanged = false;
		let flavioJson = depTree.flavioJson;
		for ( let repo of repos ) {
			if ( repo ) {
				let name;
				const index = repo.indexOf( ',' );
				if ( index > 0 ) {
					name = repo.substr( 0, index );
					repo = repo.substr( index + 1 );
				} else {
					name = await util.getDependencyNameFromRepoUrl( repo );
				}
				if ( options['save-dev'] ) {
					flavioJsonChanged = true;
					if ( !_.isObject( flavioJson.devDependencies ) ) {
						flavioJson.devDependencies = {};
					}
					flavioJson.devDependencies[name] = util.formatDefaultRepoPath( repo );
				} else {
					flavioJsonChanged = true;
					if ( !_.isObject( flavioJson.dependencies ) ) {
						flavioJson.dependencies = {};
					}
					flavioJson.dependencies[name] = util.formatDefaultRepoPath( repo );
				}				
			}
		}
		if ( flavioJsonChanged ) {
			await saveflavioJson( options.cwd, flavioJson );	
		}
	}
}

export default add;
