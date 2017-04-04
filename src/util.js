import path from 'path';
import * as git from './git.js';
import * as resolve from './resolve.js';

export async function getPackageRootPath( cwd ) {
	// TODO: read from .caliberrc
	return path.join( cwd, 'caliber_modules' );
}

/**
 * Takes a bower repository url, if there is no version or branch/tag name specified then it will add a default one (like npm does, like ^3.0.0)
 * This is used when --save or --save-dev option is specified and it is saving the repo path to caliber.json
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

/**
 * Takes a bower-style repository url and breaks it down
 *
 * @param {string} url - Repository url
 * @returns {RepositoryUrl}
 */
export function parseRepositoryUrl( url ) {
	let result = {};

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

/** Attempts to guess the name of the project from the URL
 * @param {string} url URL
 * @returns {string} Project name
 */
function guessProjectNameFromUrl( url ) {
	// remove .git at end of url if necessary
	const suffix = '.git';
	url = url.replace( /\\/g, '/' );
	if ( url.endsWith( suffix ) ) {
		url = url.substr( 0, url.length - suffix.length );
	}
	if ( url[url.length-1] === '/' ) {
		// chop off trailing slash if there is one
		url = url.substr( 0, url.length - 1 );
	}
	const index = url.lastIndexOf( '/' );
	if ( index >= 0 ) {
		return url.substr( index + 1 );
	} else {
		return url;
	}
}

/**
 * Gets the project name from project's caliber.json
 * @param {string} repo - Repository url
 * @returns {string} - Project name either from the caliber.json or guessed from the url
 */
export async function getDependencyNameFromRepoUrl( repo ) {
	const repoUrl = parseRepositoryUrl( repo );
	try {
		const targetObj = await resolve.getTargetFromRepoUrl( repo );
		const caliberJson = JSON.parse( await git.cat( repoUrl.url, 'caliber.json', targetObj ) );
		return caliberJson.name;
	} catch ( err ) {
		return guessProjectNameFromUrl( repoUrl.url );
	}
}

