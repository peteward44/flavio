import * as util from '../core/util.js';

// Used for when a recyclable tag is found, this adds all the children dependencies at the correct versions as per the parent tag
async function fixDependencyChildrenVersions( snapshotRoot, snapshot, recycledTag, tagMap ) {
	const flavioJson = await snapshot.getFlavioJsonFromBranch( recycledTag );
	const dependencies = flavioJson?.dependencies || {};
	for ( const depName of Object.keys( dependencies ) ) {
		const { snapshot: depSnapshot } = snapshotRoot.deps.get( depName );
		const ref = dependencies[depName];
		const { target: tag } = util.parseRepositoryUrl( ref );
		const target = await depSnapshot.getTarget();
		tagMap.set( depName, {
			tag, originalTarget: target, create: false, snapshot: depSnapshot 
		} );
		await fixDependencyChildrenVersions( snapshotRoot, depSnapshot, tag, tagMap );
	}
}

export default fixDependencyChildrenVersions;
