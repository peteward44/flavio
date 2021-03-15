import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import getStatus from '../core/getStatus.js';


async function status( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );
	const table = await getStatus( options, snapshotRoot );
	console.log( table.toString() );
}

export default status;
