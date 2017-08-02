import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import * as git from './git.js';
import * as util from './util.js';
import * as resolve from './resolve.js';
import uuid from 'uuid';

/**
 * Loads the flavio.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
function loadflavioJson( cwd ) {
	const p = path.join( cwd, util.getflavioJsonFileName() );
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
 * Creates tree structure of all dependencies
 */
async function buildTree( options, parentRepo, flavioJson, dir, isRoot = false, repoCache ) {
	const rootPath = await util.getPackageRootPath( options.cwd );
	let element = {
		id: uuid.v4(),
		status: 'installed',
		dir,
		repo: parentRepo,
		flavioJson: _.isObjectLike( flavioJson ) ? _.cloneDeep( flavioJson ) : undefined,
		children: new Map()
	};

	// make sure all dependencies specified in flavio.json are installed and up-to-date
	if ( flavioJson && _.isObject( flavioJson.dependencies ) ) {
		for ( const name of Object.keys( flavioJson.dependencies ) ) {
			const repoPath = flavioJson.dependencies[name];
			const childModule = {
				repo: repoPath,
				dir: name,
				id: uuid.v4()
			};
			const pkgDir = await repoCache.add( name, childModule );
			
			console.log( `Dependency ${name} checked out to ${pkgDir}` );
			
			const childflavioJson = await loadflavioJson( pkgDir );
			const child = await buildTree( options, repoPath, childflavioJson, pkgDir, false, repoCache );
			element.children.set( name, child );
			
			// if ( fs.existsSync( path.join( pkgDir, '.git' ) ) ) {
				// // check locally checked out files
				// const childflavioJson = await loadflavioJson( pkgDir );
				// const child = await buildTree( options, repoPath, childflavioJson, pkgDir, false, repoCache );
				// element.children.set( name, child );
			// } else {
				// // module not checked out
				// element.children.set( name, { status: 'missing', dir: pkgDir, repo: repoPath } );
			// }
		}
	}

	return element;
}

// calculates tree structure
async function calculate( options, repoCache ) {
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

	const tree = await buildTree( options, repoUrl, flavioJson, options.cwd, true, repoCache );	
	return tree;
}


async function _listChildren( children, found, options ) {
	for ( const [name, module] of children ) {
		if ( options.missing === false && module.status === 'missing' ) {
			continue;
		}
		if ( !found.has( name ) ) {
			found.set( name, module );
		} else {
			// TODO: check for version/branch required, see if it matches the one already checked out
		}
		if ( module.children ) {
			await _listChildren( module.children, found, options );
		}
	}
}

/**
 * builds a list of unique dependencies from a tree calculated previously by .calculate()
 *
 * @param {Object} tree - Dependency tree
 * @param {Object} [options] - List options
 * @param {boolean} [options.missing=true] - Include missing modules
 */
async function listChildren( tree, options = {} ) {
	let found = new Map();
	await _listChildren( tree.children, found, options );
	let children = [];
	for ( const [name, module] of found ) {
		module.name = name;
		children.push( module );
	}
	return children;
}

// async function _listConflicts( children, found ) {
	// for ( const [name, module] of children ) {
		// console.log( "listConflicts", name );
		// if ( !found.has( name ) ) {
			// found.set( name, [module] );
		// } else {
			// found.get( name ).push( module );
		// }
		// if ( module.children ) {
			// await _listConflicts( module.children, found );
		// }
	// }
// }

// function filterModules( modules_ ) {
	// let modules = modules_.slice( 0 );
	// for ( let i=0; i<modules.length; ++i ) {
		// const lhs = modules[i];
		// console.log( "lhs", JSON.stringify( lhs, null, 2 ) );
		// for ( let j=i+1; j<modules.length; ++j ) {
			// const rhs = modules[j];
		// }
	// }
	// return modules;
// }

// async function listConflicts( tree ) {
	// let found = new Map();
	// await _listConflicts( tree.children, found );
	// // remove any modules which don't have multiple versions
	// let filtered = new Map();
	// for ( const [name, modules] of found ) {
		// console.log( "found=", name );
		// if ( modules.length > 1 ) {
			// // in the modules array, remove any that are pointing to the same tag or branch
			// const filteredModules = filterModules( modules );
			// if ( filteredModules.length > 1 ) {
				// filtered.set( name, modules );
			// }
		// }
	// }
	// return filtered;
// }

export { calculate, listChildren/*, listConflicts */};
