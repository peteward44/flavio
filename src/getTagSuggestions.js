import semver from 'semver';

function getNextAvailableVersion( tagList, version, versionType ) {
	let test = version;
	do {
		test = semver.inc( test, versionType );
	} while ( tagList.includes( test ) );
	return test;
}

async function getTagSuggestions( snapshotRoot, snapshot ) {
	const tags = await snapshot.listTags();
	let { version } = await snapshot.getFlavioJson();
	if ( semver.prerelease( version ) ) {
		// strip the prerelease tag off if it's there
		version = semver.inc( version, 'patch' );
	}
	const suggestions = new Set();	
	if ( !tags.includes( version ) ) {
		suggestions.add( version );
		const patch = parseInt( semver.patch( version ), 10 );
		const minor = parseInt( semver.minor( version ), 10 );
		if ( patch > 0 ) {
			// add the next major version if the minor is not zero
			suggestions.add( getNextAvailableVersion( tags, version, 'minor' ) );
		}
		if ( minor > 0 || patch > 0 ) {
			// add the next major version if the minor is not zero
			suggestions.add( getNextAvailableVersion( tags, version, 'major' ) );
		}
	} else {
		for ( const type of ['minor', 'patch', 'major'] ) {
			suggestions.add( getNextAvailableVersion( tags, version, type ) );
		}
	}
	return Array.from( suggestions.values() );
}

export default getTagSuggestions;
