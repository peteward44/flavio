import Table from 'easy-table';
import chalk from 'chalk';

async function addTableRow( table, name, snapshot, options, statusOptions ) {
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
	if ( statusOptions?.changed ) {
		table.cell( 'Changed?', snapshot.hasChanged ? chalk.green( 'YES' ) : chalk.yellow( 'NO' ) );
	}
	table.cell( 'URL', await snapshot.getUrl() );
	table.newRow();
}

async function getStatus( options, snapshotRoot, statusOptions ) {
	const table = new Table();
	await addTableRow( table, 'main', snapshotRoot.main, options, statusOptions );

	for ( const [depName, depInfo] of snapshotRoot.deps.entries() ) {
		await addTableRow( table, depName, depInfo.snapshot, options, statusOptions );
	}

	return table.toString();
}

export default getStatus;
