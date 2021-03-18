import fs from 'fs';
import logger from '../core/logger.js';

const linesToPrint = 200;

function getLastLines( txt ) {
	// TODO: optimise? This reads in entire file, divides it *all* and then rejoins it
	return txt.split( linesToPrint ).slice( -linesToPrint ).join( "\n" );
}

async function log( options ) {
	const file = logger.getLogFilePath( options.all );
	const txt = getLastLines( fs.readFileSync( file, 'utf8' ).toString() );
	console.log( txt );
}

export default log;
