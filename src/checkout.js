import fs from 'fs-extra';
import _ from 'lodash';
import * as util from './util.js';
import * as git from './git.js';
import * as depTree from './depTree.js';
import { checkAndSwitch } from './dependencies.js';
import * as getSnapshot from './getSnapshot.js';
import globalConfig from './globalConfig.js';

async function exe( snapshot, options, name, dir, branch ) {
	if ( fs.existsSync( dir ) ) {
		try {
			const local = await git.doesLocalBranchExist( dir, branch );
			const url = await snapshot.getUrl( true );
			const remote = await git.doesRemoteBranchExist( url, branch );
			if ( local || remote ) {
				console.log( `${name}: Checking out branch ${branch}` );
				const repo = await snapshot.getUrl();
				const repoUrl = util.parseRepositoryUrl( repo );
				await checkAndSwitch( snapshot, options, dir, `${repoUrl.url}#${branch}` );
			}
		} catch ( err ) {
			console.error( `Error executing checkout` );
			console.error( err );
		}
	}
}

/**
 *
 *
 */
async function checkout( branch, options = {} ) {
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	await util.readConfigFile( options.cwd );
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	
	await exe( snapshot.main, options, 'root', options.cwd, branch );
	
	const modules = await depTree.listChildren( options );
	console.log( `${modules.size} dependencies found` );
	
	for ( const depInfo of snapshot.deps.values() ) {
		await exe( depInfo.snapshot, options, depInfo.snapshot.name, depInfo.snapshot.dir, branch );
	}
}

export default checkout;
