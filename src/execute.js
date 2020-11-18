import * as fs from 'fs';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';


async function exe( name, dir, args ) {
	if ( fs.existsSync( dir ) ) {
		console.log( `${name}: "git ${args.join( " " )}"` );
		try {
			await git.executeGit( args, { cwd: dir, outputStderr: true } );
		} catch ( err ) {
			console.error( `Error executing command` );
		}
	}
}


async function execute( options ) {
	util.defaultOptions( options );
	await util.readConfigFile( options.cwd );
	const args = options._.slice( 1 ); // "execute" will appear as first element in array
	if ( args.length === 0 ) {
		console.error( `No command specified for execute command. Usage: flavio execute -- status` );
		return;
	}
	await exe( 'root', options.cwd, args );
	
	const modules = await depTree.listChildren( options );
	console.log( `${modules.size} dependencies found` );
	
	for ( const [name, moduleArray] of modules ) {
		await exe( name, moduleArray[0].dir, args );
	}
}

export default execute;
