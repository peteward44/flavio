import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import calculateDependencyTree from './calculateDependencyTree.js';
import * as util from './util.js';
import * as git from './git.js';
import * as resolve from './resolve.js';

async function installMissing( children ) {
	// download/update modules
	for ( const [name, module] of children ) {
		if ( !module.installed ) {
			console.log( `Installing ${name} [${module.repo}]...` );
			const repoUrl = util.parseRepositoryUrl( module.repo );
			const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
			await git.clone( repoUrl.url, module.dir, targetObj );
			console.log( `Complete` );
		}
		if ( module.children ) {
			await installMissing( module.children );
		}
	}
}

async function updateMainProject( options ) {
	const stashName = await git.stash( options.cwd );
	await git.pull( options.cwd );
	await git.stashPop( options.cwd, stashName );
}


/**
 * Saves the caliber.json to the given directory
 *
 * @param {string} cwd - Working directory
 * @param {Object} json - New caliber.json data object
 * @returns {Promise}
 */
export function saveCaliberJson( cwd, json ) {
	const p = path.join( cwd, util.getCaliberJsonFileName() );
	return new Promise( (resolv, reject) => {
		fs.writeFile( p, JSON.stringify( json, null, 2 ), 'utf-8', (err) => {
			err ? reject( err ) : resolv();
		} );
	} );
}

async function updateOutofDate( children ) {
	for ( const [name, module] of children ) {
		console.log( `Updating ${name} [${module.repo}]...` );
		// check if the repo path resolves to a different target (ie. it was on a tag 0.1.0, but should now be 0.1.1).
		// If it is, switch over to that. Otherwise, just do a basic pull
		const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
		const targetCur = await git.getCurrentTarget( module.dir );
		const targetChanged = targetObj.branch !== targetCur.branch || targetObj.tag !== targetCur.tag;
		
		const stashName = await git.stash( module.dir );
		if ( targetChanged ) {
			console.log( `Switching package ${name} to ${targetObj.branch || targetObj.tag}` );
			await git.checkout( module.dir, targetObj );
		}
		await git.pull( module.dir );
		await git.stashPop( module.dir, stashName );
		// TODO: detect local change conflicts and report if any
		console.log( `Complete` );
		if ( module.children ) {
			await updateOutofDate( module.children );
		}
	}
}

/**
 * Executes install on given directory
 *
 * @param {Array.<string>|string} repos - Array of repository paths in "bower format" to add to the project, or empty to install all dependencies inside caliber.json
 * @param {Object} options - Command line options
 * @param {string} options.cwd - Working directory
 * @param {boolean} [options.force-latest=false] - Force latest version on conflict
 * @param {boolean} [options.production=false] - If true, does not install devDependencies
 * @param {boolean} [options.save=false] - Save any specified modules to the caliber.json dependencies
 * @param {boolean} [options.save-dev=false] - Saves any specified modules to the caliber.json devDependencies
 */
async function install(repos, options, update = false) {
	if ( !Array.isArray( repos ) ) {
		repos = [repos];
	}
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	await util.readConfigFile( options.cwd );
	if ( update ) {
		// if updating, update main project first
		console.log( `Updating main project...` );
		await updateMainProject( options );
		console.log( `Complete` );
	}
	const depTree = await calculateDependencyTree( options, repos, update );
	
	// TODO: resolve any conflicts in dep tree

	await installMissing( depTree.children );
	
	if ( update ) {
		await updateOutofDate( depTree.children );
	}
	// add new modules to the caliber.json
	if ( repos.length > 0 && ( options.save || options['save-dev'] ) ) {
		let caliberJsonChanged = false;
		let caliberJson = depTree.caliberJson;
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
				if ( options.save ) {
					caliberJsonChanged = true;
					if ( !_.isObject( caliberJson.dependencies ) ) {
						caliberJson.dependencies = {};
					}
					caliberJson.dependencies[name] = util.formatDefaultRepoPath( repo );
				} else if ( options['save-dev'] ) {
					caliberJsonChanged = true;
					if ( !_.isObject( caliberJson.devDependencies ) ) {
						caliberJson.devDependencies = {};
					}
					caliberJson.devDependencies[name] = util.formatDefaultRepoPath( repo );
				}			
			}
		}
		if ( caliberJsonChanged ) {
			await saveCaliberJson( options.cwd, caliberJson );	
		}
	}
}

export default install;
