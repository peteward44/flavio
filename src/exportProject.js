import path from 'path';
import fs from 'fs-extra';
import * as util from './util.js';
import * as resolve from './resolve.js';
import * as git from './git.js';
import flavio from './index.js';
import * as depTree from './depTree.js';

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
	console.log( `Exporting main project to ${destDir}` );
	await copyFiles( options.cwd, destDir );
	// copy over dependencies
	const modules = await depTree.listChildren( options );
	for ( const [name, moduleArray] of modules ) {
		const mod = moduleArray[0];
		console.log( `Exporting ${mod.name} dependency` );
		const destMod = path.relative( options.cwd, mod.dir );
		await copyFiles( mod.dir, path.join( destDir, destMod ) );
	}
	console.log( `Export complete` );
}

export default exportProject;
