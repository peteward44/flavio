import * as _ from 'lodash';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

export function formatConsoleDependencyName( name, error = false ) {
	if ( error ) {
		return `[${chalk.red(name)}]`;
	} else {
		return `[${chalk.blue(name)}]`;
	}
}

/**
 * Takes a bower-style repository url and breaks it down
 *
 * @param {string} url - Repository url
 * @returns {RepositoryUrl}
 */
export function parseRepositoryUrl( url ) {
	let result = {};
	
	// strip any git+ or svn+ on the front to keep bower compatibility
	const plusIndex = url.indexOf( '+' );
	if ( plusIndex >= 0 ) {
		url = url.substring( plusIndex + 1 );
	}

	const hashIndex = url.indexOf('#');
	if (hashIndex >= 0) {
		// specified branch / tag at end
		result.target = url.substr(hashIndex + 1);
		url = url.substr(0, hashIndex);
	} else {
		result.target = 'master';
	}

	result.url = url;

	return result;
}

/**
 * Takes a bower repository url, if there is no version or branch/tag name specified then it will add a default one (like npm does, like ^3.0.0)
 * This is used when --save or --save-dev option is specified and it is saving the repo path to flavio.json
 *
 * @param {string} repo - repository path in "bower format"
 * @returns {string} - Modified repository path (or same as 'repo' param if no modification required)
 */
export function formatDefaultRepoPath( repo ) {
	const repoUrl = parseRepositoryUrl( repo );
	if ( repoUrl.target === 'master' ) {
		repo = `${repoUrl.url}#master`;
	}
	return repo.replace( /\\/g, '/' );
}

export function getGitProjectNameFromUrl( repo ) {
	const match = repo.match( /\/([^/]*?)\.git/i );
	if ( match ) {
		return match[1];
	}
	return '';
}

/**
 * Loads the flavio.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
export async function loadFlavioJson( cwd ) {
	const p = path.join( cwd, 'flavio.json' );
	return new Promise( (resolv, reject) => {
		fs.readFile( p, 'utf8', (err, txt) => {
			err ? resolv( '{}' ) : resolv( txt );
		} );
	} )
		.then( (txt) => {
			return JSON.parse( txt.toString() );
		} );
}

/**
 * Saves the flavio.json to the given directory
 *
 * @param {string} cwd - Working directory
 * @param {Object} json - New flavio.json data object
 * @returns {Promise}
 */
export async function saveFlavioJson( cwd, json ) {
	const p = path.join( cwd, 'flavio.json' );
	return new Promise( (resolv, reject) => {
		fs.writeFile( p, JSON.stringify( json, null, 2 ), 'utf-8', (err) => {
			err ? reject( err ) : resolv();
		} );
	} );
}

export function getDefaultLinkDir() {
	// get default dir for drive we are on
	if ( os.platform() === "win32" ) {
		// on windows, make sure link dir is on the same drive as the repo
		const parsedHome = path.parse( os.homedir() );
		const parsedCwd = path.parse( process.cwd() );
		if ( parsedHome.root !== parsedCwd.root ) {
			return path.join( parsedCwd.root, '.flavio', 'link' );
		}
	}
	return path.join( os.homedir(), '.flavio', 'link' );
}

let gDefaultOptions = {};

export function defaultOptions( options ) {
	_.defaults( options, gDefaultOptions );
	if ( !options.linkdir ) {
		options.linkdir = getDefaultLinkDir();
	}
	if ( options.link === undefined ) {
		options.link = true;
	}
}

// used by tests to alter the options used
export function overrideDefaultOptions( defaultOptionsObject ) {
	gDefaultOptions = _.cloneDeep( defaultOptionsObject );
}
