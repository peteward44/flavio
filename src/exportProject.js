import path from 'path';
import fs from 'fs-extra';
import * as util from './util.js';
import * as git from './git.js';
import * as getSnapshot from './getSnapshot.js';
import globalConfig from './globalConfig.js';

async function copyFiles( rootSrc, destDir ) {
	fs.ensureDirSync( destDir );
	fs.copySync( path.join( rootSrc, '.git' ), path.join( destDir, '.git' ) );
	const srcFiles = await git.listFiles( rootSrc );
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
	await util.readConfigFile( options.cwd );
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );

	console.log( `Exporting main project to ${destDir}` );
	await copyFiles( snapshot.main.dir, destDir );
	// copy over dependencies
	for ( const depInfo of snapshot.deps.values() ) {
		console.log( `Exporting ${depInfo.snapshot.name} dependency` );
		const destMod = path.relative( options.cwd, depInfo.snapshot.dir );
		await copyFiles( depInfo.snapshot.dir, path.join( destDir, destMod ) );
	}
	console.log( `Export complete` );
}

export default exportProject;
