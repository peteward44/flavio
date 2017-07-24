import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import * as git from './git.js';
import * as util from './util.js';
import * as resolve from './resolve.js';

/**
 * Loads the flavio.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
function loadflavioJson( cwd ) {
	const p = path.join( cwd, util.getflavioJsonFileName() );
	return new Promise( (resolv, reject) => {
		fs.readFile( p, 'utf-8', (err, txt) => {
			err ? resolv( '{}' ) : resolv( txt );
		} );
	} )
	.then( (txt) => {
		return JSON.parse( txt.toString() );
	} );
}

async function getflavioJsonFromRepo( repoPath ) {
	const repoUrl = util.parseRepositoryUrl( repoPath );
	const targetObj = await resolve.getTargetFromRepoUrl( repoPath );
	try {
		return JSON.parse( await git.cat( repoUrl.url, util.getflavioJsonFileName(), targetObj ) );
	} catch ( err ) {
		return null;
	}
}

/**
 * Creates tree structure of all dependencies
 */
async function buildTree( options, parentRepo, flavioJson, dir, installed = true, repos = [], isRoot = false ) {
	const rootPath = await util.getPackageRootPath( options.cwd );
	let element = {
		installed,
		dir,
		repo: parentRepo,
		flavioJson: _.isObjectLike( flavioJson ) ? _.cloneDeep( flavioJson ) : undefined,
		children: new Map()
	};

	// make sure all dependencies specified in flavio.json are installed and up-to-date
	if ( flavioJson && _.isObject( flavioJson.dependencies ) ) {
		for ( const name of Object.keys( flavioJson.dependencies ) ) {
			const repoPath = flavioJson.dependencies[name];
			const pkgDir = path.join( rootPath, name );
			const filePath = path.join( pkgDir, '.git' );
			if ( fs.existsSync( filePath ) ) {
				// check locally checked out files
				const childflavioJson = await loadflavioJson( pkgDir );
				const child = await buildTree( options, repoPath, childflavioJson, pkgDir, true, [], false );
				element.children.set( name, child );
			} else {
				// else module isn't installed, check the remote repo
				try {
					const childflavioJson = await getflavioJsonFromRepo( repoPath );
					const child = await buildTree( options, repoPath, childflavioJson, pkgDir, false, [], false );
					element.children.set( name, child );
				} catch ( err ) {
					// no flavio.json present in module
					element.children.set( name, { installed: false, dir: pkgDir, repo: repoPath } );
				}
			}
		}
	}

	return element;
}


async function calculateDependencyTree( options, repos = [] ) {
	let flavioJson;
	try {
		flavioJson = await loadflavioJson( options.cwd );
	} catch ( err ) {
	}
	let repoUrl;
	try {
		repoUrl = await git.getWorkingCopyUrl( options.cwd );
	} catch ( err ) {
	}
	const tree = await buildTree( options, repoUrl, flavioJson, options.cwd, true, repos, true );	
	return tree;
}

export default calculateDependencyTree;
