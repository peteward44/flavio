import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import * as util from '../core/util.js';
import { getLinkedRepoDir } from '../core/dependencies.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import logger from '../core/logger.js';

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

async function check( snapshot ) {
	if ( !await snapshot.isWorkingCopyClean() ) {
		const question = {
			type: 'confirm',
			name: 'q',
			message: `Package ${snapshot.name} has local uncommited changes, are you sure you wish to delete?`
		};
		const answer = await inquirer.prompt( [question] );
		return answer.q;
	}
	return true;
}

/**
 *
 *
 */
async function clear( options = {}, all = false ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	if ( !fs.existsSync( options.linkdir ) ) {
		logger.log( 'info', `Link directory "${options.linkdir}" not found, aborting..` );
		return;
	}
	if ( all ) {
		const dirs = fs.readdirSync( options.linkdir );
		if ( dirs.length === 0 ) {
			logger.log( 'info', `Link directory is empty, nothing to do` );
		} else {
			logger.log( 'info', `Processing ${dirs.length} module${dirs.length > 1 ? 's' : ''}...` );
		}
		for ( const leaf of dirs ) {
			const p = path.join( options.linkdir, leaf );
			if ( fs.statSync( p ).isDirectory() ) {
				logger.log( 'info', util.formatConsoleDependencyName( leaf ), `Deleting...` );
				await safeDelete( p );
				logger.log( 'info', util.formatConsoleDependencyName( leaf ), `done` );
			}
		}
	} else {
		const snapshot = await getSnapshot.getSnapshot( options.cwd );
		const count = snapshot.deps.size;
		if ( count === 0 ) {
			logger.log( 'info', `No dependencies found, nothing to do` );
		} else {
			logger.log( 'info', `Processing ${count} module${count > 1 ? 's' : ''}...` );
		}
		for ( const depInfo of snapshot.deps.values() ) {
			if ( await check( depInfo.snapshot ) ) {
				const repoUrl = util.parseRepositoryUrl( depInfo.refs[0] );
				const dir = getLinkedRepoDir( options, repoUrl );
				logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `Deleting...` );
				if ( fs.existsSync( dir ) && fs.statSync( dir ).isDirectory() ) {
					await safeDelete( dir );
				}
				logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `done` );
			}
		}
	}
}

export default clear;
