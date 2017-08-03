import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import * as git from './git.js';
import * as util from './util.js';
import * as resolve from './resolve.js';
import uuid from 'uuid';


/**
 * Creates tree structure of all dependencies
 */
async function buildTree( options, parentRepo, flavioJson, dir, isRoot = false, repoCache ) {
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
			const pkgDir = await repoCache.add( name, childModule );
			
			console.log( `Dependency ${name} checked out to ${pkgDir}` );
			
			const childflavioJson = await util.loadFlavioJson( pkgDir );
			const child = await buildTree( options, repoPath, childflavioJson, pkgDir, false, repoCache );
			element.children.set( name, child );
		}
	}

	return element;
}

// calculates tree structure
async function traverse( options, repoCache ) {
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

	const tree = await buildTree( options, repoUrl, flavioJson, options.cwd, true, repoCache );	
	return tree;
}

export { traverse };
