import _ from 'lodash';
import Table from 'easy-table';
import chalk from 'chalk';
import * as util from './util.js';

async function addTableRow( table, depInfo, options, statusOptions, isRoot = false ) {
	let diff = false;
	const { snapshot } = depInfo;
	
	table.cell( 'Repository', snapshot.name );
	
	const target = await snapshot.getTarget();
	// TODO: maybe move this comparison between ref / target logic somewhere else as checkForCorrectRefs.js does the same thing
	
	const parsedRef = _.isArray( depInfo.refs ) ? util.parseRepositoryUrl( depInfo.refs[0] ) : null;
	let targetTableEntry;
	if ( target ) {
		const targetString = target.commit || target.tag || target.branch;
		if ( parsedRef && parsedRef.target !== targetString ) {
			targetTableEntry = chalk.magenta( `${targetString}` ) + ' [' + chalk.yellow( `${parsedRef.target}` ) + `]`;
			diff = true;
		} else {
			targetTableEntry = chalk.magenta( `${targetString}` );
		}
	} else {
		if ( isRoot ) {
			targetTableEntry = chalk.blue( 'no repo' );
		} else {
			targetTableEntry = chalk.red( 'missing' );
			diff = true;
		}
	}
	table.cell( 'Target', targetTableEntry );
	
	if ( target ) {
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
			table.cell( 'Changed?', snapshot.changeID > 0 ? chalk.green( 'YES' ) : chalk.yellow( 'NO' ) );
		}
	}
	let url = await snapshot.getUrl();
	if ( !url ) {
		if ( _.isArray( depInfo.refs ) && depInfo.refs.length > 0 ) {
			url = depInfo.refs[0]; // eslint-disable-line prefer-destructuring
		}
	}
	if ( url ) {
		table.cell( 'URL', url );
	}
	table.newRow();
	return diff;
}

async function getStatus( options, snapshotRoot, statusOptions ) {
	const table = new Table();
	await addTableRow( table, { snapshot: snapshotRoot.main }, options, statusOptions, true );

	let diffCount = 0;
	for ( const depInfo of snapshotRoot.deps.values() ) {
		if ( await addTableRow( table, depInfo, options, statusOptions ) ) {
			diffCount++;
		}
	}

	if ( diffCount > 0 ) {
		return `${table.toString()}
${diffCount} repositories have different targets to their flavio.json definitions: Use "flavio update --switch" to fix`;
	} else {
		return table.toString();
	}
}

export default getStatus;
