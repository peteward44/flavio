import fs from 'fs';
import path from 'path';
import * as gsi from 'git-svn-interface';

/**
 * Loads the caliber.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
export function loadCaliberJson( cwd ) {
	const p = path.join( cwd, 'caliber.json' );
	return new Promise( (resolve, reject) => {
		fs.readFile( p, 'utf-8', (err, txt) => {
			err ? resolve( '{}' ) : resolve( txt );
		} );
	} )
	.then( (txt) => {
		return JSON.parse( txt.toString() );
	} );
}

/**
 * Saves the caliber.json to the given directory
 *
 * @param {string} cwd - Working directory
 * @param {Object} json - New caliber.json data object
 * @returns {Promise}
 */
export function saveCaliberJson( cwd, json ) {
	const p = path.join( cwd, 'caliber.json' );
	return new Promise( (resolve, reject) => {
		fs.saveFile( p, JSON.stringify( json, null, 2 ), 'utf-8', (err) => {
			err ? reject( err ) : resolve();
		} );
	} )
}

/**
 * @typedef {Object} RepositoryUrl
 * @property {string} url - Repository unadorned url
 * @property {string} scm - Source control - either 'svn' or 'git'
 * @property {string} [target] - The bit after the # - so either specifies a semver range or branch/tag name
 */

/**
 * Takes a bower-style repository url and breaks it down
 *
 * @param {string} url - Repository url
 * @returns {RepositoryUrl}
 */
export function parseRepositoryUrl( url ) {
	let result = {};
	const plusIndex = url.indexOf('+');
	if (plusIndex >= 0) {
		// transport type specified at start of url
		result.scm = url.substr(0, plusIndex);
		url = url.substr(plusIndex + 1);
	} else {
		result.scm = 'git';
	}

	const hashIndex = url.indexOf('#');
	if (hashIndex >= 0) {
		// specified branch / tag at end
		result.target = url.substr(hashIndex + 1);
		url = url.substr(0, hashIndex);
	}

	result.url = url;

	return result;
}

/**
 * @param {string} cwd - Working directory
 * @returns {Promise.<string>} - Root path to save all packages
 */
export function getPackageRootPath( cwd ) {
	return Promise.resolve( path.join( cwd, 'caliber_modules' ) );
}

/**
 * @param {string} scm - Source control type string - either svn or git
 * @returns {*} - Object interface for the particular scm type from the git-svn-interface library
 */
export function getSCM( scm ) {
	switch (scm) {
		case 'git':
			return gsi.git;
		case 'svn':
			return gsi.svn;
		default:
			throw new Error(`Unknown source control type '${scm}'`);
	}
}

