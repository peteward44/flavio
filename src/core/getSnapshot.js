import snapshotPool from './snapshotPool.js';
import GitRepositorySnapshot from './GitRepositorySnapshot.js';

function getExistingKeyName( depMap, key ) {
	const lkey = key.toLowerCase();
	for ( const lhs of depMap.keys() ) {
		if ( lhs.toLowerCase() === lkey ) {
			return lhs;
		}
	}
	return key;
}

export async function walk( depMap, repo, oldSnapshotRoot, overwriteRef = false ) {
	const dependencies = await repo.getDependencies();
	for ( const depName of Object.keys( dependencies ) ) {
		const depUrl = dependencies[depName];
		const keyName = getExistingKeyName( depMap, depName );
		if ( !depMap.has( keyName ) ) {
			let snapshot = null;
			if ( oldSnapshotRoot && oldSnapshotRoot.deps.has( keyName ) ) {
				snapshot = oldSnapshotRoot.deps.get( keyName ).snapshot;
			}
			if ( !snapshot ) {
				snapshot = await snapshotPool.fromName( keyName, depUrl );
			}
			depMap.set( keyName, {
				snapshot,
				refs: [depUrl],
				children: {}
			} );
			await walk( depMap, snapshot, oldSnapshotRoot );
		} else {
			const depInfo = depMap.get( keyName );
			if ( !depInfo.refs.includes( depUrl ) ) {
				depInfo.refs.push( depUrl );
			}
		}
	}
}

// export async function updateNode( graph, repoName, depUrl, oldSnapshot ) {
	// let snapshot;
	// if ( !oldSnapshot ) {
		// snapshot = await GitRepositorySnapshot.fromName( repoName );
	// } else {
		// snapshot = oldSnapshot;
	// }
	// depMap.set( keyName, {
		// snapshot,
		// refs: [depUrl],
		// children: {}
	// } );
	// await walk( depMap, snapshot, oldSnapshotRoot, true );
// }

export async function getSnapshot( dir, oldSnapshot ) {
	const main = oldSnapshot ? oldSnapshot.main : await GitRepositorySnapshot.fromDir( dir );
	const graph = {
		main,
		deps: new Map()
	};
	// build map of all dependencies - excluding ones that haven't been cloned yet. They will have a status of "missing" and their dependencies will be missing too
	await walk( graph.deps, main, oldSnapshot );
	return graph;
}
