import fs from 'fs-extra';
import path from 'path';
import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';

async function guessProjectName( cwd ) {
	// if a package.json or bower.json exists, take name from there
	const pkgPath = path.join( cwd, 'package.json' );
	if ( fs.existsSync( pkgPath ) ) {
		return JSON.parse( fs.readFileSync( pkgPath ) ).name;
	}
	const bowerPath = path.join( cwd, 'bower.json' );
	if ( fs.existsSync( bowerPath ) ) {
		return JSON.parse( fs.readFileSync( bowerPath ) ).name;
	}
	// otherwise fall back to directory name
	return path.basename( cwd );
}

async function init( options ) {
	await globalConfig.init( options.cwd );
	if ( fs.existsSync( path.join( options.cwd, 'flavio.json' ) ) ) {
		console.error( `flavio.json already exists, aborting` );
		return;
	}
	const name = await guessProjectName( options.cwd );
	const json = {
		name,
		version: "0.1.0-snapshot.0"
	};
	await util.saveFlavioJson( options.cwd, json );
	console.log( `Successfully wrote flavio.json` );
}

export default init;
