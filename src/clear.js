import path from 'path';
import fs from 'fs-extra';
import * as util from './util.js';
import * as depTree from './depTree.js';
import { getLinkedRepoDir } from './dependencies.js';

/**
 * Safely deletes a file / directory without throwing any errors
 *
 * @param {string} filename - Name of file / directory to delete
 */
async function safeDelete( filename ) {
	const totalAttempts = 20;
	for ( let attempt = 0; attempt < totalAttempts; ++attempt ) {
		try {
			if ( fs.existsSync( filename ) ) {
				await fs.remove( filename );
			} else {
				return;
			}
		} catch ( err ) {
			await new Promise( (resolve) => setTimeout( resolve, 100 ) );
		}
		return;
	}
}

/**
 *
 *
 */
async function clear( options = {}, all = false ) {
	util.defaultOptions( options );
	if ( options.cwd ) {
		await util.readConfigFile( options.cwd );
	}
	if ( !fs.existsSync( options.linkdir ) ) {
		console.log( `Link directory "${options.linkdir}" not found, aborting..` );
		return;
	}
	if ( all ) {
		const dirs = fs.readdirSync( options.linkdir );
		if ( dirs.length === 0 ) {
			console.log( `Link directory is empty, nothing to do` );
		} else {
			console.log( `Processing ${dirs.length} module${dirs.length > 1 ? 's' : ''}...` );
		}
		for ( const leaf of dirs ) {
			const p = path.join( options.linkdir, leaf );
			if ( fs.statSync( p ).isDirectory() ) {
				console.log( util.formatConsoleDependencyName( leaf ), `Deleting...` );
				await safeDelete( p );
				console.log( util.formatConsoleDependencyName( leaf ), `done` );
			}
		}
	} else {
		const modules = await depTree.listChildren( options );
		const count = modules.size;
		if ( count === 0 ) {
			console.log( `No dependencies found, nothing to do` );
		} else {
			console.log( `Processing ${count} module${count > 1 ? 's' : ''}...` );
		}
		for ( const moduleArray of modules.values() ) {
			const module = moduleArray[0];
			const repoUrl = util.parseRepositoryUrl( module.repo );
			const dir = getLinkedRepoDir( options, repoUrl );
			console.log( util.formatConsoleDependencyName( module.name ), `Deleting...` );
			if ( fs.existsSync( dir ) && fs.statSync( dir ).isDirectory() ) {
				await safeDelete( dir );
			}
			console.log( util.formatConsoleDependencyName( module.name ), `done` );
		}
	}
}

export default clear;
