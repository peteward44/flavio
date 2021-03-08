import * as util from './util.js';

async function checkForConflicts( snapshotRoot, checkForLocalChanges = false ) {
	let conflicts = [];
	const mainProjectName = snapshotRoot.main.name;
	if ( await snapshotRoot.main.isConflicted() ) {
		console.log( util.formatConsoleDependencyName( mainProjectName, true ), `Main project has conflicts` );
		conflicts.push( snapshotRoot.main );
	} else if ( checkForLocalChanges && !await snapshotRoot.main.isWorkingCopyClean() ) {
		console.log( util.formatConsoleDependencyName( mainProjectName, true ), `Main project has local changes` );
		conflicts.push( snapshotRoot.main );
	}
	for ( const depInfo of snapshotRoot.deps.values() ) {
		if ( await depInfo.snapshot.isConflicted() ) {
			console.log( util.formatConsoleDependencyName( depInfo.snapshot.name, true ), `Conflicts detected` );
			conflicts.push( depInfo.snapshot );
		} else if ( checkForLocalChanges && !await depInfo.snapshot.isWorkingCopyClean() ) {
			console.log( util.formatConsoleDependencyName( depInfo.snapshot.name, true ), `Local changes detected` );
			conflicts.push( depInfo.snapshot );
		}
	}
	return conflicts;
}

export default checkForConflicts;
