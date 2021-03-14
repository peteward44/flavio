import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import tagSnapshot from '../tag/tagSnapshot.js';

/**
 *
 *
 */
async function tagOperation( options = {} ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	console.log( `Inspecting dependencies for tagging operation...` );	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );

	await tagSnapshot( options, snapshotRoot, snapshotRoot.main );
}

export default tagOperation;
