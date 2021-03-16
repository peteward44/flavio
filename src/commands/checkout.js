import fs from 'fs-extra';
import _ from 'lodash';
import * as util from '../core/util.js';
import { checkAndSwitch } from '../core/dependencies.js';
import * as getSnapshot from '../core/getSnapshot.js';
import globalConfig from '../core/globalConfig.js';
import logger from '../core/logger.js';

async function exe( snapshot, options, branch ) {
	if ( fs.existsSync( snapshot.dir ) ) {
		try {
			const local = await snapshot.doesLocalBranchExist( branch );
			const remote = await snapshot.doesRemoteBranchExist( branch );
			if ( local || remote ) {
				logger.log( 'info', `${snapshot.name}: Checking out target ${branch}` );
				const repo = await snapshot.getUrl();
				const repoUrl = util.parseRepositoryUrl( repo );
				await checkAndSwitch( snapshot, options, snapshot.dir, `${repoUrl.url}#${branch}` );
			} else {
				logger.log( 'info', `${snapshot.name}: "${branch}" does not exist in this repository` );
			}
		} catch ( err ) {
			logger.log( 'error', `Error executing checkout` );
			logger.log( 'error', err );
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

	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	
	await exe( snapshot.main, options, branch );
	
	for ( const depInfo of snapshot.deps.values() ) {
		await exe( depInfo.snapshot, options, branch );
	}
}

export default checkout;
