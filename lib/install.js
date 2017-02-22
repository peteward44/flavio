import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import * as util from './util.js';

/**
 * @typedef {Object} TargetDescription
 * @property {string} name - Name
 * @property {string} type - Either 'trunk' 'branch' or 'tag'
 */

/**
 * Returns a target description object used by the git-svn-interface library from a repo url
 *
 * @param {string} repo - Repository path in "bower format"
 * @returns {Promise.<TargetDescription>}
 */
function getTargetDescriptionFromRepoUrl( repo ) {
	// TODO:
	return Promise.resolve( {
		name: 'trunk',
		type: 'trunk'
	} );
}

/**
 * Clones a fresh repo OR updates it, if it already exists
 *
 * @param {Object} options - Command line options
 * @param {string} name - Name of module
 * @param {string} repo - Repository path in "bower format"
 */
async function cloneUpdatePackage( options, name, repo ) {
	const rootDir = await util.getPackageRootPath( options.cwd );
	const repoUrl = util.parseRepositoryUrl( repo );
	const scm = util.getSCM( repoUrl.scm );
	const pkgDir = path.join( rootDir, name );
	if ( util.dirExists( pkgDir ) ) {
		await scm.update([pkgDir]);
	} else {
		fs.ensureDirSync( pkgDir );
		const targetDesc = await getTargetDescriptionFromRepoUrl( repo );
		await scm.checkout( repoUrl.url, targetDesc, pkgDir );
	}
}

/**
 * Given array of repository paths, will work out which one will map to the latest version of the package
 *
 * @param {Array.<string>} repos - Array of repository paths in "bower format"
 * @returns {string} - Whichever path in the 'repos' param is the latest version
 */
function getLatestVersion( repos ) {
	// TODO:
	return repos[0];
}

/**
 * Takes a bower repository url, if there is no version or branch/tag name specified then it will add a default one (like npm does, like ^3.0.0)
 * This is used when --save or --save-dev option is specified and it is saving the repo path to caliber.json
 *
 * @param {string} repo - repository path in "bower format"
 * @returns {string} - Modified repository path (or same as 'repo' param if no modification required)
 */
function formatDefaultRepoPath( repo ) {
	// TODO:
	return repo;
}

/**
 * Executes install on given directory
 *
 * @param {Array.<string>|string} repos - Array of repository paths in "bower format" to add to the project, or empty to install all dependencies inside caliber.json
 * @param {Object} options - Command line options
 * @param {string} options.cwd - Working directory
 * @param {boolean} [options.force-latest=false] - Force latest version on conflict
 * @param {boolean} [options.production=false] - If true, does not install devDependencies
 * @param {boolean} [options.save=false] - Save any specified modules to the caliber.json dependencies
 * @param {boolean} [options.save-dev=false] - Saves any specified modules to the caliber.json devDependencies
 */
async function install(repos, options) {
	if ( !Array.isArray( repos ) ) {
		repos = [repos];
	}
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	let caliberJson = await util.loadCaliberJson( options.cwd );
	let caliberJsonChanged = false;
	
	// build list of modules to either clone fresh or update
	// this way any conflicts can be detected before any downloading is done
	// map of module names vs their 'bower' repository paths we should use
	let repoMap = new Map();
	// map of module names vs array of bower repository names, if there are multiple different versions of the same module specified
	let conflicts = new Map();
	
	function addRepo( name, repoPath ) {
		if ( repoMap.has( name ) ) {
			// repository name has already been added - add to conflict array to be resolved later
			if ( !conflicts.has( name ) ) {
				conflicts.set( name, [] );
			}
			if ( !conflicts.get( name ).includes( repoPath ) ) {
				conflicts.get( name ).push( repoPath );
				// if it's a new conflict, work out the latest version and keep that in the repoMap map
				repoMap.set( name, getLatestVersion( conflicts.get( name ) ) );
			}
		} else {
			repoMap.set( name, repoPath );
		}
	}
	
	// make sure all dependencies specified in caliber.json are installed and up-to-date
	if ( _.isObject( caliberJson.dependencies ) ) {
		for ( const name of Object.keys( caliberJson.dependencies ) ) {
			const repoPath = caliberJson.dependencies[name];
			addRepo( name, repoPath );
		}
	}
	if ( !options.production && _.isObject( caliberJson.devDependencies ) ) {
		for ( const name of Object.keys( caliberJson.devDependencies ) ) {
			const repoPath = caliberJson.devDependencies[name];
			addRepo( name, repoPath );
		}
	}

	// install each repo specified on command line
	// array of new module names to add to the caliber.json
	let newModules = [];
	for ( const repo of repos ) {
		if ( repo ) {
			const name = "TestName"; // TODO: get from project's caliber.json, or if one doesn't exist, work out from 'bower' URL
			// TODO: make sure 'name' is unique
			let repoPath = repo; // TODO: work out semver default / appropriate branch name if one not specified
			addRepo( name, repoPath );
			newModules.push( name );
		}
	}

	// TODO: do any conflict resolution here
	for ( const [name, conflictArray] of conflicts ) {
		
	}
	
	// download/update modules
	for ( const [name, repo] of repoMap ) {
		await cloneUpdatePackage( options, name, repo );
	}
	
	// add new modules to the caliber.json
	for ( const name of newModules ) {
		if ( options.save ) {
			caliberJsonChanged = true;
			if ( !_.isObject( caliberJson.dependencies ) ) {
				caliberJson.dependencies = {};
			}
			caliberJson.dependencies[name] = formatDefaultRepoPath( repoMap.get( name ) );
		} else if ( options['save-dev'] ) {
			caliberJsonChanged = true;
			if ( !_.isObject( caliberJson.devDependencies ) ) {
				caliberJson.devDependencies = {};
			}
			caliberJson.devDependencies[name] = formatDefaultRepoPath( repoMap.get( name ) );
		}
	}
	// save caliber.json if --save or --save-dev options specified
	if ( caliberJsonChanged ) {
		await util.saveCaliberJson( options.cwd, caliberJson );	
	}
}

export default install;
