import path from 'path';
import * as util from './util.js';
import globalConfig from './globalConfig.js';
import * as getSnapshot from './getSnapshot.js';
import getRecycledTag from './getRecycledTag.js';

async function getInfoObjectForDependency( snapshotRoot, snapshot, recycleTagMap ) {
	const recycledTag = await getRecycledTag( snapshotRoot, snapshot, recycleTagMap );
	const { version } = await snapshot.getFlavioJson();
	return {
		name: snapshot.name,
		version,
		dir: path.relative( snapshotRoot.main.dir, snapshot.dir ).replace( /\\/g, '/' ),
		recycledTag
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
	await util.readConfigFile( options.cwd );
	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );
	const info = await getInfoObject( snapshotRoot );
	
	console.log( JSON.stringify( info ) );
}

export default taginfo;
