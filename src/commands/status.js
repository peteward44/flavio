import Table from 'easy-table';
import chalk from 'chalk';
import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';

async function addTableRow( table, name, snapshot, options ) {
	const target = await snapshot.getTarget();
	table.cell( 'Repository', name );
	table.cell( 'Target', chalk.magenta( target.commit || target.tag || target.branch ) );
	
	let uptodate = '';
	if ( target.commit ) {
		uptodate = chalk.yellow( '(commit)' );
	} else if ( target.tag ) {
		uptodate = chalk.yellow( '(tag)' );
	} else {
		if ( !options.nofetch ) {
			uptodate = ( await snapshot.isUpToDate() ) ? chalk.green( 'YES' ) : chalk.yellow( 'NO' );
		} else {
			uptodate = chalk.yellow( 'n/a' );
		}
	}
	table.cell( 'Up to date?', uptodate );

	table.cell( 'Conflicts?', await snapshot.isConflicted() ? chalk.red( 'CONFLICT' ) : chalk.green( 'CLEAN' ) );
	table.cell( 'Local changes?', await snapshot.isWorkingCopyClean() ? chalk.green( 'CLEAN' ) : chalk.yellow( 'CHANGES' ) );
	table.cell( 'URL', await snapshot.getUrl() );
	table.newRow();
}

async function status( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	const table = new Table();
	await addTableRow( table, 'main', snapshot.main, options );

	for ( const [depName, depInfo] of snapshot.deps.entries() ) {
		await addTableRow( table, depName, depInfo.snapshot, options );
	}

	console.log( table.toString() );
}

export default status;
