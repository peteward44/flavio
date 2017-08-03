import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import * as git from './git.js';
import * as util from './util.js';


/**
 * Creates tree structure of all dependencies
 */
async function buildTree( options, parentRepo, flavioJson, dir, isRoot = false, nodeCallback ) {
	const rootPath = await util.getPackageRootPath( options.cwd );
	let element = {
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
				dir: name
			};
			const pkgDir = path.join( rootPath, name );
			if ( fs.existsSync( pkgDir ) ) {
				const repoState = await util.hasRepoChanged( repoPath, pkgDir );
				if ( repoState === 'url' ) {
					childModule.status = 'conflict-url';
				} else if ( repoState === 'target' ) {
					childModule.status = 'conflict-target';
				} else {
					childModule.status = 'installed';
				}
			} else {
				childModule.status = 'missing';
			}
			await nodeCallback( name, childModule );

			const childflavioJson = await util.loadFlavioJson( pkgDir );
			const child = await buildTree( options, repoPath, childflavioJson, pkgDir, false, nodeCallback );
			element.children.set( name, child );
		}
	}

	return element;
}

// calculates tree structure
async function traverse( options, nodeCallback ) {
	let flavioJson;
	try {
		flavioJson = await util.loadFlavioJson( options.cwd );
	} catch ( err ) {
	}
	let repoUrl;
	try {
		repoUrl = await git.getWorkingCopyUrl( options.cwd );
	} catch ( err ) {
	}

	const tree = await buildTree( options, repoUrl, flavioJson, options.cwd, true, nodeCallback );	
	return tree;
}

export { traverse };
