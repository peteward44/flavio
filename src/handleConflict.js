import _ from 'lodash';
import path from 'path';
import inquirer from 'inquirer';
import semver from 'semver';
import * as git from './git.js';
import * as util from './util.js';


/**
 * @returns {string} - Returns the repo to use
 */
async function handleConflict( options, name, module, rootFlavioJson ) {
	console.log( `Conflict! ${name} ${module}` );
	const rootPath = await util.getPackageRootPath( options.cwd );
	const pkgdir = path.join( rootPath, module.dir );
	const localUrl = await git.getWorkingCopyUrl( pkgdir, false );
	const localRepoUrl = util.parseRepositoryUrl( localUrl );
	const otherRepoUrl = util.parseRepositoryUrl( module.repo );
	const isSameRepo = localRepoUrl.url === otherRepoUrl.url;
	
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
	let latest;
	if ( isSameRepo ) {
		const lhs = semver.valid( semver.clean( localRepoUrl.target ) );
		const rhs = semver.valid( semver.clean( otherRepoUrl.target ) );
		if ( lhs && rhs ) {
			// both target names are valid semver names, figure out which is higher
			const gt = semver.gt( lhs, rhs );
			latest = gt ? localUrl : module.repo;
		}
	}
	
	if ( options['force-latest'] || !isInteractive ) {
		if ( latest ) {
			return latest;
		}
	}
	
	if ( isInteractive ) {
		// ask user	which they prefer - if it's the same repo, then just display the target names. Otherwise display full repo URLs
		const question = {
			type: 'list',
			name: 'q',
			message: `Conflict detected for package ${name}` + ( isSameRepo ? ` ${localRepoUrl.url}` : `` ),
			choices: [
				isSameRepo ? localRepoUrl.target : localUrl,
				isSameRepo ? otherRepoUrl.target : module.repo
			],
			default: latest === localUrl ? 0 : 1
		};
		const answer = await inquirer.prompt( [question] );
		return isSameRepo ? `${localRepoUrl.url}#${answer.q}` : answer.q;
	}
	// always fall back to the pre-existing repo if no other alternative can be found
	return localUrl;
}

export default handleConflict;
