import semver from 'semver';

async function getNextMasterVersion( snapshot, version ) {
	if ( !await snapshot.isUpToDate() ) {
		// only increment version in flavio.json if our local HEAD is up to date with the remote branch
		return null;
	}
	const prerelease = semver.prerelease( version );
	return semver.inc( version, `preminor`, prerelease ? prerelease[0] : 'snapshot' );
}

export default getNextMasterVersion;
