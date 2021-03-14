import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import tagSnapshot from '../tag/tagSnapshot.js';

/**
 *
 *
 */
async function tagdep( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	console.log( `Inspecting dependencies for tagging operation...` );	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );

	if ( !snapshotRoot.deps.has( options.dependency ) ) {
		console.error( `Dependency "${options.dependency}" not found` );
		process.exitCode = 1;
		return;
	}
	const dep = snapshotRoot.deps.get( options.dependency );
	await tagSnapshot( options, snapshotRoot, dep.snapshot );
}

export default tagdep;
