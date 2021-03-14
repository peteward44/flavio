import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import tagSnapshot from '../tag/tagSnapshot.js';
import parseSpecificVersionsCommandLine from '../tag/parseSpecificVersionsCommandLine.js';

/**
 *
 *
 */
async function tagOperation( options = {} ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	console.log( `Inspecting dependencies for tagging operation...` );	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );

	const specificVersions = parseSpecificVersionsCommandLine( options, snapshotRoot, snapshotRoot.main );
	await tagSnapshot( options, snapshotRoot, snapshotRoot.main, specificVersions );
}

export default tagOperation;
