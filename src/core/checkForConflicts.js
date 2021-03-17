import * as getSnapshot from './getSnapshot.js';

async function checkForConflicts( snapshotRoot, snapshot, checkForLocalChanges = false ) {
	const depMap = new Map();
	depMap.set( snapshot.name, { snapshot, refs: [] } );
	await getSnapshot.walk( depMap, snapshot, snapshotRoot );
	
	let conflicts = [];
	for ( const depInfo of depMap.values() ) {
		if ( await depInfo.snapshot.isConflicted() ) {
			conflicts.push( depInfo.snapshot );
		} else if ( checkForLocalChanges && !await depInfo.snapshot.isWorkingCopyClean() ) {
			conflicts.push( depInfo.snapshot );
		}
	}
	return conflicts;
}

export default checkForConflicts;
