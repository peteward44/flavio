import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import * as util from '../core/util.js';
import update from './update.js';
import globalConfig from '../core/globalConfig.js';
import executeGit from '../core/executeGit.js';
import logger from '../core/logger.js';

/**
 *
 *
 */
async function clone( repo, options = {} ) {
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	const repoUrl = util.parseRepositoryUrl( repo );
	// clone the repo first so it'll be on master, then checkout to the target object.
	// that way we can use the 'master' clone to list tags and so on so we can resolve the correct target without any temporary
	// clones
	let { cwd } = options;
	const gitname = util.getGitProjectNameFromUrl( repo );
	if ( !cwd ) {
		cwd = path.join( process.cwd(), gitname || 'project' );
	}
	if ( !options.force && cwd !== '.' && fs.existsSync( cwd ) ) {
		throw new Error( `Target directory ${cwd} already exists!` );
	}
	logger.log( 'info', util.formatConsoleDependencyName( gitname || 'main' ), `Cloning main respository to ${chalk.yellow(cwd)}` );
	const args = ['clone', repoUrl.url, cwd];
	if ( repoUrl.target && repoUrl.target !== 'master' ) {
		args.push( `--branch=${repoUrl.target}` );
	}
	await executeGit( cwd, args );

	logger.log( 'info', util.formatConsoleDependencyName( gitname || 'main' ), `Clone complete, executing update...` );
	options.cwd = cwd;
	options.fromCloneCommand = true;
	await update( options );
}

export default clone;
