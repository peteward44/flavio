import fs from 'fs-extra';
import path from 'path';
import Table from 'easy-table';
import chalk from 'chalk';
import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import * as getSnapshot from '../core/getSnapshot.js';
import getRecycledTag from '../tag/getRecycledTag.js';
import getTagSuggestions from '../tag/getTagSuggestions.js';
import getNextMasterVersion from '../tag/getNextMasterVersion.js';

async function getInfoObjectForDependency( snapshotRoot, snapshot, recycleTagMap ) {
	const target = await snapshot.getTarget();
	const recycledTag = await getRecycledTag( snapshotRoot, snapshot, recycleTagMap );
	const { version } = await snapshot.getFlavioJson();
	const suggestions = recycledTag ? [] : await getTagSuggestions( snapshotRoot, snapshot );
	const nextMasterVersion = recycledTag ? null : await getNextMasterVersion( snapshot, version );
	return {
		name: snapshot.name,
		target,
		version,
		dir: path.relative( snapshotRoot.main.dir, snapshot.dir ).replace( /\\/g, '/' ),
		recycledTag,
		suggestions,
		nextMasterVersion
	};
}

async function getInfoObject( snapshotRoot ) {
	const recycleTagMap = new Map();
	const info = {};
	info.main = await getInfoObjectForDependency( snapshotRoot, snapshotRoot.main, recycleTagMap );
	info.deps = [];
	for ( const depInfo of snapshotRoot.deps.values() ) {
		const dep = await getInfoObjectForDependency( snapshotRoot, depInfo.snapshot, recycleTagMap );
		info.deps.push( dep );
	}
	return info;
}

async function taginfo( options ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );

	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );
	const info = await getInfoObject( snapshotRoot );

	if ( options.output ) {
		const dir = path.dirname( options.output );
		if ( dir && dir !== '.' ) {
			fs.ensureDirSync( dir );
		}
		fs.writeFileSync( options.output, JSON.stringify( info, null, 2 ), 'utf8' );
	}

	const table = new Table();
	for ( const depInfo of [info.main, ...info.deps] ) {
		table.cell( 'Name', depInfo.name );
		table.cell( 'Target', chalk.magenta( depInfo.target.commit || depInfo.target.tag || depInfo.target.branch ) );
		table.cell( 'Version', depInfo.version );
		if ( depInfo.recycledTag ) {
			table.cell( 'Tag', chalk.yellow( depInfo.recycledTag ) );
		} else if ( Array.isArray( depInfo.suggestions ) && depInfo.suggestions.length > 0 ) {
			table.cell( 'Tag', chalk.green( depInfo.suggestions[0] ) );
		}
		table.cell( 'New tag?', depInfo.recycledTag ? chalk.yellow( 'NO' ) : chalk.blue( 'YES' ) );
		table.newRow();
	}
	console.log( table.toString() );
}

export default taginfo;
