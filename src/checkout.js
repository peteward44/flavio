import fs from 'fs-extra';
import _ from 'lodash';
import * as util from './util.js';
import * as git from './git.js';
import * as depTree from './depTree.js';


async function exe( name, dir, branch ) {
	if ( fs.existsSync( dir ) ) {
		try {
			const local = await git.doesLocalBranchExist( dir, branch );
			const url = await git.getWorkingCopyUrl( dir, true );
			const remote = await git.doesRemoteBranchExist( url, branch );
			if ( local || remote ) {
				console.log( `${name}: Checking out branch ${branch}` );
				await git.checkout( dir, { branch } );
			}
		} catch ( err ) {
			console.error( `Error executing checkout` );
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
	await util.readConfigFile( options.cwd );
	
	await exe( 'root', options.cwd, branch );
	
	const modules = await depTree.listChildren( options );
	console.log( `${modules.size} dependencies found` );
	
	for ( const [name, moduleArray] of modules ) {
		await exe( name, moduleArray[0].dir, branch );
	}
}

export default checkout;
