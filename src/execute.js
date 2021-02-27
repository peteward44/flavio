import * as fs from 'fs';
import * as util from './util.js';
import * as git from './git.js';
import * as getSnapshot from './getSnapshot.js';
import globalConfig from './globalConfig.js';

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
	await globalConfig.init( options.cwd );
	await util.readConfigFile( options.cwd );
	const args = options._.slice( 1 ); // "execute" will appear as first element in array
	if ( args.length === 0 ) {
		console.error( `No command specified for execute command. Usage: flavio execute -- status` );
		return;
	}
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	
	await exe( 'root', snapshot.main.dir, args );
	
	console.log( `${snapshot.deps.size} dependencies found` );
	
	for ( const [name, depInfo] of snapshot.deps.entries() ) {
		await exe( name, depInfo.snapshot.dir, args );
	}
}

export default execute;
