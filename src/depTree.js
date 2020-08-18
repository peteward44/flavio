import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import * as git from './git.js';
import * as util from './util.js';


/**
 * Creates tree structure of all dependencies
 */
async function buildTree( options, name, parentRepo, dir, isRoot = false, nodeCallback ) {
	const rootPath = await util.getPackageRootPath( options.cwd );
	let element = {
		name,
		dir,
		repo: parentRepo,
		children: new Map()
	};

	if ( fs.existsSync( dir ) ) {
		const repoState = await util.hasRepoChanged( parentRepo, dir );
		if ( repoState === 'url' ) {
			element.status = 'conflict-url';
		} else if ( repoState === 'target' ) {
			element.status = 'conflict-target';
		} else {
			element.status = 'installed';
		}
	} else {
		element.status = 'missing';
	}

	if ( !isRoot && nodeCallback ) {
		await nodeCallback( name, element );
	}

	if (!options['ignore-dependencies']) {
		const flavioJson = await util.loadFlavioJson( dir );

		// make sure all dependencies specified in flavio.json are installed and up-to-date
		if ( flavioJson && _.isObject( flavioJson.dependencies ) ) {
			for ( const childName of Object.keys( flavioJson.dependencies ) ) {
				const repoPath = flavioJson.dependencies[childName];
				const childPath = path.join( rootPath, childName );
				const child = await buildTree( options, childName, repoPath, childPath, false, nodeCallback );
				element.children.set( childName, child );
			}
		}
	}

	return element;
}

// calculates tree structure
async function traverse( options, nodeCallback = null ) {
	let repoUrl;
	try {
		repoUrl = await git.getWorkingCopyUrl( options.cwd );
	} catch ( err ) {
	}
	if ( !repoUrl ) {
		throw new Error( `Not a git repository "${options.cwd}"` );
	}
	let mainName = '__main__';
	try {
		const flavioJson = await util.loadFlavioJson( options.cwd );
		if ( flavioJson.name ) {
			mainName = flavioJson.name;
		}
	} catch ( err ) {
	}

	const tree = await buildTree( options, mainName, repoUrl, options.cwd, true, nodeCallback );
	return tree;
}


async function listChildren( options ) {
	let modules = new Map();
	// build map of all modules
	await traverse( options, ( name, childModule ) => {
		if ( !modules.has( name ) ) {
			modules.set( name, [] );
		}
		modules.get( name ).push( childModule );
	} );
	// for modules with multiple conflicts, make sure the one that occupies the current folder is first in the array
	for ( const [name, moduleArray] of modules ) { // eslint-disable-line no-unused-vars
		if ( moduleArray.length > 1 ) {
			const index = _.findIndex( moduleArray, (mod) => mod.status === 'installed' );
			if ( index > 0 ) {
				const installedMod = moduleArray.splice( index, 1 )[0];
				moduleArray.unshift( installedMod );
			}
		}
	}
	return modules;
}


export { traverse, listChildren };
