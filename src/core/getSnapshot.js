import _ from 'lodash';
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

export async function walk( depMap, repo, oldSnapshotRoot ) {
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
				snapshot = await GitRepositorySnapshot.fromName( keyName );
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

export async function getSnapshot( dir, oldSnapshot ) {
	const main = oldSnapshot ? oldSnapshot.main : await GitRepositorySnapshot.fromDir( dir );
	const result = {
		main,
		deps: new Map()
	};
	// build map of all dependencies - excluding ones that haven't been cloned yet. They will have a status of "missing" and their dependencies will be missing too
	await walk( result.deps, main, oldSnapshot );
	return result;
}
