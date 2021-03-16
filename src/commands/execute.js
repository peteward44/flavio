import * as util from '../core/util.js';
import * as getSnapshot from '../core/getSnapshot.js';
import globalConfig from '../core/globalConfig.js';
import logger from '../core/logger.js';

async function exe( snapshot, args ) {
	if ( await snapshot.getStatus() === 'installed' ) {
		logger.log( 'info', util.formatConsoleDependencyName( snapshot.name ), `Executing "git ${args.join( " " )}"..` );
		try {
			const result = await snapshot.execute( args );
			logger.log( 'info', result.combined );
		} catch ( err ) {
			logger.log( 'error', `Error executing command`, err );
		}
	}
}

async function execute( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	const args = options._.slice( 1 ); // "execute" will appear as first element in array
	if ( args.length === 0 ) {
		logger.log( 'error', `No command specified for execute command. Usage: flavio execute -- status` );
		return;
	}
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	
	await exe( snapshot.main, args );
	
	for ( const depInfo of snapshot.deps.values() ) {
		await exe( depInfo.snapshot, args );
	}
}

export default execute;
