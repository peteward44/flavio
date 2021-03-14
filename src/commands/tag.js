import _ from 'lodash';
import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import tagSnapshot from '../tag/tagSnapshot.js';


function getDependencyByName( deps, name ) {
	const lcName = name.toLowerCase();
	for ( const depInfo of deps.values() ) {
		if ( depInfo.snapshot.name.toLowerCase() === lcName ) {
			return depInfo;
		}
	}
	return null;
}

function parseSpecificVersionsCommandLine( options, snapshotRoot ) {
	const versions = {};
	if ( options.version ) {
		versions[snapshotRoot.main.name] = options.version;
	}
	if ( _.isArray( options.versions ) ) {
		for ( const versionString of options.versions ) {
			const match = versionString.match( /^(.*)\=(.*)$/ );
			if ( !match ) {
				throw new Error( `Version string provided does not have DEPENDENCY=TAGNAME format [version=${versionString}]` );
			}
			const depName = match[1].toLowerCase();
			const tag = match[2];
			// find dependency is snapshot, case-insensitive
			const dep = getDependencyByName( snapshotRoot.deps, depName );
			if ( !dep ) {
				throw new Error( `Dependency "${depName}" could not be found!` );
			}
			versions[dep.name] = tag;
		}
	}
	return versions;
}

/**
 *
 *
 */
async function tagOperation( options = {} ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	console.log( `Inspecting dependencies for tagging operation...` );	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );

	const specificVersions = parseSpecificVersionsCommandLine( options, snapshotRoot );
	await tagSnapshot( options, snapshotRoot, snapshotRoot.main, specificVersions );
}

export default tagOperation;
