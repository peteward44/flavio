import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import * as git from './git.js';
import * as util from './util.js';
import * as resolve from './resolve.js';

/**
 * Loads the caliber.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
function loadCaliberJson( cwd ) {
	const p = path.join( cwd, 'caliber.json' );
	return new Promise( (resolv, reject) => {
		fs.readFile( p, 'utf-8', (err, txt) => {
			err ? resolv( '{}' ) : resolv( txt );
		} );
	} )
	.then( (txt) => {
		return JSON.parse( txt.toString() );
	} );
}

async function getCaliberJsonFromRepo( repoPath ) {
	const repoUrl = util.parseRepositoryUrl( repoPath );
	const targetObj = await resolve.getTargetFromRepoUrl( repoPath );
	try {
		const childCaliberJson = JSON.parse( await git.cat( repoUrl.url, 'caliber.json', targetObj ) );
		return childCaliberJson;
	} catch ( err ) {
		return null;
	}
}

/**
 * Creates tree structure of all dependencies
 */
async function buildTree( options, parentRepo, caliberJson, dir, installed = true, repos = [], isRoot = false, update = false ) {
	let element = {
		installed,
		dir,
		repo: parentRepo,
		caliberJson: caliberJson ? _.clone( caliberJson ) : caliberJson,
		children: new Map()
	};
	async function addRepo( name, repoPath ) {
		const pkgDir = path.join( await util.getPackageRootPath( options.cwd ), name );
		const filePath = path.join( pkgDir, '.git' );
		if ( fs.existsSync( filePath ) ) {
			// check locally checked out files
			let childCaliberJson;
			if ( !update ) {
				childCaliberJson = await loadCaliberJson( pkgDir );
			} else {
				childCaliberJson = await getCaliberJsonFromRepo( repoPath );
			}
			const child = await buildTree( options, repoPath, childCaliberJson, pkgDir, true, [], false, update );
			element.children.set( name, child );
		} else {
			// else module isn't installed, check the remote repo
			try {
				const childCaliberJson = await getCaliberJsonFromRepo( repoPath );
				const child = await buildTree( options, repoPath, childCaliberJson, pkgDir, false, [], false, update );
				element.children.set( name, child );
			} catch ( err ) {
				// no caliber.json present in module
				element.children.set( name, { installed: false, dir: pkgDir, repo: repoPath } );
			}
		}
	}
	
	// make sure all dependencies specified in caliber.json are installed and up-to-date
	if ( caliberJson && _.isObject( caliberJson.dependencies ) ) {
		for ( const name of Object.keys( caliberJson.dependencies ) ) {
			const repoPath = caliberJson.dependencies[name];
			await addRepo( name, repoPath );
		}
	}
	if ( isRoot && !options.production && caliberJson && _.isObject( caliberJson.devDependencies ) ) {
		for ( const name of Object.keys( caliberJson.devDependencies ) ) {
			const repoPath = caliberJson.devDependencies[name];
			await addRepo( name, repoPath );
		}
	}

	// install each repo specified on command line
	// array of new module names to add to the caliber.json
	if ( isRoot ) {
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
				await addRepo( name, repo );
			}
		}
	}
	return element;
}


async function calculateDependencyTree( options, repos = [], update ) {
	let caliberJson;
	try {
		caliberJson = await loadCaliberJson( options.cwd );
	} catch ( err ) {
	}
	let repoUrl;
	try {
		repoUrl = await git.getWorkingCopyUrl( options.cwd );
	} catch ( err ) {
	}
	const tree = await buildTree( options, repoUrl, caliberJson, options.cwd, true, repos, true, update );	
	return tree;
}

export default calculateDependencyTree;
