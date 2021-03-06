import path from 'path';
import fs from 'fs-extra';
import * as util from '../core/util.js';
import * as getSnapshot from '../core/getSnapshot.js';
import globalConfig from '../core/globalConfig.js';
import logger from '../core/logger.js';

async function copyFiles( snapshot, destDir ) {
	const rootSrc = snapshot.dir;
	fs.ensureDirSync( destDir );
	fs.copySync( path.join( rootSrc, '.git' ), path.join( destDir, '.git' ) );
	const srcFiles = await snapshot.listFiles();
	for ( const file of srcFiles ) {
		fs.copySync( path.join( rootSrc, file ), path.join( destDir, file ) );
	}
}

/**
 * Copies all tracked files into a new directory, without any ignored or untracked files included
 *
 */
async function exportProject( destDir, options = {} ) {
	// copy over main project
	await globalConfig.init( options.cwd );
	util.defaultOptions( options );
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );

	logger.log( 'info', `Exporting main project to ${destDir}` );
	await copyFiles( snapshot.main, destDir );
	if ( !options['ignore-dependencies'] ) {
		// copy over dependencies
		for ( const depInfo of snapshot.deps.values() ) {
			logger.log( 'info', util.formatConsoleDependencyName( depInfo.snapshot.name ), `Exporting..` );
			const destMod = path.relative( options.cwd, depInfo.snapshot.dir );
			await copyFiles( depInfo.snapshot, path.join( destDir, destMod ) );
		}
	}
	logger.log( 'info', `Export complete` );
}

export default exportProject;
