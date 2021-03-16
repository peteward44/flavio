import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import tagSnapshot from '../tag/tagSnapshot.js';
import parseSpecificVersionsCommandLine from '../tag/parseSpecificVersionsCommandLine.js';
import logger from '../core/logger.js';

/**
 *
 *
 */
async function tagdep( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	logger.log( 'info', `Inspecting dependencies for tagging operation...` );	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );

	if ( !snapshotRoot.deps.has( options.dependency ) ) {
		logger.log( 'error', `Dependency "${options.dependency}" not found` );
		process.exitCode = 1;
		return;
	}
	const dep = snapshotRoot.deps.get( options.dependency );
	const specificVersions = parseSpecificVersionsCommandLine( options, snapshotRoot, dep.snapshot );
	await tagSnapshot( options, snapshotRoot, dep.snapshot, specificVersions );
}

export default tagdep;
