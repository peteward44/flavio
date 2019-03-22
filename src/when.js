import fs from 'fs-extra';
import _ from 'lodash';
import * as util from './util.js';
//import * as git from './git.js';
import * as depTree from './depTree.js';


async function exe( name, dir, date ) {
	if ( fs.existsSync( dir ) ) {
		try {
			console.log( `Setting date for ${name} as ${date.toString()}` );
		} catch ( err ) {
			console.error( `Error executing when command` );
			console.error( err );
		}
	}
}


/**
 *
 *
 */
async function when( date, options = {} ) {
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	await util.readConfigFile( options.cwd );
	
	await exe( 'root', options.cwd, date );
	
	const modules = await depTree.listChildren( options );
	console.log( `${modules.size} dependencies found` );
	
	for ( const [name, moduleArray] of modules ) {
		await exe( name, moduleArray[0].dir, date );
	}
}

export default when;
