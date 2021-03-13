import * as util from '../core/util.js';
import * as getSnapshot from '../core/getSnapshot.js';
import globalConfig from '../core/globalConfig.js';

async function exe( snapshot, args ) {
	if ( await snapshot.getStatus() === 'installed' ) {
		console.log( `${snapshot.name}: "git ${args.join( " " )}"` );
		try {
			await snapshot.execute( args );
		} catch ( err ) {
			console.error( `Error executing command` );
		}
	}
}

async function execute( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	const args = options._.slice( 1 ); // "execute" will appear as first element in array
	if ( args.length === 0 ) {
		console.error( `No command specified for execute command. Usage: flavio execute -- status` );
		return;
	}
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	
	await exe( snapshot.main, args );
	
	console.log( `${snapshot.deps.size} dependencies found` );
	
	for ( const depInfo of snapshot.deps.values() ) {
		await exe( depInfo.snapshot, args );
	}
}

export default execute;
