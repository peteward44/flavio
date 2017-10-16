import Table from 'easy-table';
import chalk from 'chalk';
import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';


async function addTableRow( table, name, mod ) {
	const target = await git.getCurrentTarget( mod.dir );
	table.cell( 'Repository', name );
	table.cell( 'Target', chalk.magenta( target.commit || target.tag || target.branch ) );
	table.cell( 'Up to date?', await git.isUpToDate( mod.dir ) ? chalk.green( 'YES' ) : chalk.yellow( 'NO' ) );
	table.cell( 'Conflicts?', await git.isConflicted( mod.dir ) ? chalk.red( 'CONFLICT' ) : chalk.green( 'CLEAN' ) );
	table.cell( 'Local changes?', await git.isWorkingCopyClean( mod.dir ) ? chalk.green( 'CLEAN' ) : chalk.yellow( 'CHANGES' ) );
	table.cell( 'URL', mod.repo );
	table.newRow();
}

async function status( options ) {
	await util.readConfigFile( options.cwd );
	const modules = await depTree.listChildren( options );

	const table = new Table();
	
	const mainProjectName = await util.getMainProjectName( options.cwd );
	const mainProjectRepo = await git.getWorkingCopyUrl( options.cwd );
	await addTableRow( table, mainProjectName, { dir: options.cwd, repo: mainProjectRepo } );

	for ( const [name, moduleArray] of modules ) {
		const mod = moduleArray[0];
		await addTableRow( table, name, mod );
	}
	
	console.log( table.toString() );
}

export default status;
