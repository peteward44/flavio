import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import gsi from 'git-svn-interface';
import * as util from './util.js';

/**
 * @typedef PackageDescriptor
 * @property {string} name - Name of package as defined in caliber.json
 * @property {string} version - Current version
 * @property {string} path - Directory path
 * @property {string} repo - Repository path in 'bower' format
 * @property {string} scm - Source control type, either 'git' or 'svn'
 * @property {Object} targetDesc - Target descriptor, contains 'name' and 'type' - either trunk, tag or branch
 */


async function processCaliberJson( options, caliberJson, result ) {
	const dependencyRootPath = await util.getPackageRootPath( options.cwd );
	
	async function pushDep( name, repo ) {
		const depPath = path.join( dependencyRootPath, name );
		const depCaliberJson = JSON.parse( fs.readFileSync( path.join( depPath, 'caliber.json' ) ) );
		const dep = util.parseRepositoryUrl( repo );
		const workingCopyInfo = await gsi[dep.scm].getWorkingCopyInfo( depPath );
		result.push( {
			name,
			repo,
			version: depCaliberJson.version,
			path: depPath,
			scm: dep.scm,
			targetDesc: workingCopyInfo.targetDesc
		} );
		// process dependencies
		await processCaliberJson( options, depCaliberJson, result );
	}
	
	if ( _.isObject( caliberJson.dependencies ) ) {
		for ( const name of Object.keys( caliberJson.dependencies ) ) {
			await pushDep( name, caliberJson.dependencies[name] );
		}
	}

	if ( !options.production && _.isObject( caliberJson.devDependencies ) ) {
		for ( const name of Object.keys( caliberJson.devDependencies ) ) {
			await pushDep( name, caliberJson.devDependencies[name] );
		}
	}
	return result;
}

/**
 * Gets a list of the available packages currently installed
 *
 * @param {Object} options - Command line options
 * @returns {Promise.<Array.<PackageDescriptor>>}
 */
async function buildPackageList( options ) {
	// get main repo information from working copy
	let result = [];
	let transport;
	let scm;
	if ( gsi.git.isWorkingCopy( options.cwd ) ) {
		transport = gsi.git;
		scm = 'git';
	} else {
		transport = gsi.svn;
		scm = 'svn';
	}
	const { name, url, targetDesc } = await transport.getWorkingCopyInfo( options.cwd );
	const caliberJson = JSON.parse( fs.readFileSync( path.join( options.cwd, 'caliber.json' ) ) );
	result.push( {
		name: caliberJson.name,
		path: options.cwd,
		version: caliberJson.version,
		repo: util.formatRepositoryUrl( scm, url, targetDesc ),
		scm,
		targetDesc
	} );
	// then process all dependencies
	await processCaliberJson( options, caliberJson, result );
	return result;
}

export default buildPackageList;
