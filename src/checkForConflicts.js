import fs from 'fs-extra';
import path from 'path';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';

async function checkForConflicts( options, checkForLocalChanges = false ) {
	if ( fs.existsSync( path.join( options.cwd, '.git' ) ) ) {
		const mainProjectName = await util.getMainProjectName( options.cwd );
		if ( await git.isConflicted( options.cwd ) ) {
			console.log( util.formatConsoleDependencyName( mainProjectName, true ), `Main project has conflicts` );
			return true;
		}
		if ( checkForLocalChanges ) {
			if ( !await git.isWorkingCopyClean( options.cwd ) ) {
				console.log( util.formatConsoleDependencyName( mainProjectName, true ), `Main project has local changes` );
				return true;
			}
		}
	}
	let conflicts = false;
	await depTree.traverse( options, async ( name, childModule ) => {
		if ( fs.existsSync( path.join( childModule.dir, '.git' ) ) ) {
			if ( await git.isConflicted( childModule.dir ) ) {
				console.log( util.formatConsoleDependencyName( childModule.name, true ), `Conflicts detected` );
				conflicts = true;
			}
			if ( checkForLocalChanges ) {
				if ( !await git.isWorkingCopyClean( childModule.dir ) ) {
					console.log( util.formatConsoleDependencyName( childModule.name, true ), `Local changes detected` );
					conflicts = true;
				}
			}
		}
	} );
	return conflicts;
}

export default checkForConflicts;
