import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';

async function tagdep( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );

	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );
	
	snapshotRoot.main;
}

export default tagdep;
