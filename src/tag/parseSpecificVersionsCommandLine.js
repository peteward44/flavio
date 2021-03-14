import _ from 'lodash';

function getDependencyByName( deps, name ) {
	const lcName = name.toLowerCase();
	for ( const depInfo of deps.values() ) {
		if ( depInfo.snapshot.name.toLowerCase() === lcName ) {
			return depInfo;
		}
	}
	return null;
}

function parseSpecificVersionsCommandLine( options, snapshotRoot, mainSnapshot ) {
	const versions = {};
	if ( options.tag ) {
		versions[mainSnapshot.name] = options.tag;
	}
	if ( _.isArray( options.versions ) ) {
		for ( const versionString of options.versions ) {
			const match = versionString.match( /^(.*)=(.*)$/ );
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
			versions[dep.snapshot.name] = tag;
		}
	}
	return versions;
}

export default parseSpecificVersionsCommandLine;
