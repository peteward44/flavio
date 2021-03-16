import _ from 'lodash';
import inquirer from 'inquirer';
import semver from 'semver';
import * as util from './util.js';
import logger from "./logger.js";

/**
 * @returns {module} - Returns the repo to use
 */
async function handleConflict( options, name, moduleArray, rootFlavioJson ) {
	logger.log( 'info', `Conflict! ${name}` );

	// check the root flavio.json to see if a conflict resolver has been defined already
	if ( _.isObject( rootFlavioJson.resolutions ) ) {
		if ( rootFlavioJson.resolutions.hasOwnProperty( name ) ) {
			// resolution has been defined, return that
			return rootFlavioJson.resolutions[name];
		}
	}
	
	// if always-latest option specified, fall back to latest version if tags
	const isInteractive = options.interactive !== false;

	// if the conflict is between different versions of the same repo, then always try to work out the latest version
	// (assuming they use semantic versioning for their tags)
	let latest = null;
	let latestSem = null;
	let master = null;
	for ( const module of moduleArray ) {
		const repoUrl = util.parseRepositoryUrl( module );
		if ( repoUrl.target === 'master' ) {
			master = module;
		}
		const sem = semver.valid( semver.clean( repoUrl.target ) );
		if ( sem ) {
			if ( latest === null || semver.gt( sem, latestSem ) ) {	
				latest = module;
				latestSem = sem;
			}
		}
	}
	if ( latest === null ) {
		latest = master;
	}
	if ( isInteractive && !options['force-latest'] ) {
		// ask user	which they prefer
		const question = {
			type: 'list',
			name: 'q',
			message: `Conflict detected for package ${name}`,
			choices: moduleArray,
			default: _.findIndex( (module) => module === latest ) || 0
		};
		const answer = await inquirer.prompt( [question] );
		return _.find( moduleArray, (module) => answer.q === module );
	}
	return latest || master || moduleArray[0];
}

export default handleConflict;
