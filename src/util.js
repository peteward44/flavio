import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import * as git from './git.js';

let gConfig = null;

export async function readConfigFile( cwd = process.cwd() ) {
	gConfig = {};
	try {
		const rc = path.join( cwd, '.flaviorc' );
		if ( fs.existsSync( rc ) ) {
			gConfig = JSON.parse( fs.readFileSync( rc ) );
		}
	} catch ( err ) {
	}
}


export async function getPackageRootPath( cwd ) {
	// read from .flaviorc
	if ( _.isString( gConfig.directory ) ) {
		return path.join( cwd, gConfig.directory );
	}
	return path.join( cwd, 'flavio_modules' );
}

export async function getflavioJsonFileName() {
	// read from .flaviorc
	if ( _.isString( gConfig.filename ) ) {
		return gConfig.filename;
	}
	return 'flavio.json';
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


// Removes any credentials and protocol from a URL so they can be compared correctly
function stripRepoUrl( repo ) {
	return repo.replace( /^http[s]*:\/\/(.*@)*/, '' );
}


/**
 * @returns {Promise.<string>} - Either 'url', 'target' or empty string, depending what has changed on the repo
 */
export async function hasRepoChanged( repo, dir ) {
	const repoUrl = parseRepositoryUrl( repo );
	// make sure it's the same repo URL
	const localUrl = await git.getWorkingCopyUrl( dir, true );
	if ( stripRepoUrl( localUrl ) !== stripRepoUrl( repoUrl.url ) ) {
		// Repository URL is different to pre-existing module "name"
		return 'url';
	}
	const targetCur = await git.getCurrentTarget( dir );
	if ( targetCur.tag && targetCur.tag !== repoUrl.target ) {
		return 'target';
	}
	if ( targetCur.commit && targetCur.commit !== repoUrl.target ) {
		return 'target';
	}
	if ( targetCur.branch && targetCur.branch !== repoUrl.target ) {
		return 'target';
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
	const p = path.join( cwd, await getflavioJsonFileName() );
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
	const p = path.join( cwd, await getflavioJsonFileName() );
	return new Promise( (resolv, reject) => {
		fs.writeFile( p, JSON.stringify( json, null, 2 ), 'utf-8', (err) => {
			err ? reject( err ) : resolv();
		} );
	} );
}
