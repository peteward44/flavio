import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import * as util from './util.js';
import * as resolve from './resolve.js';
import * as git from './git.js';
import flavio from './index.js';

/**
 *
 *
 */
async function clone( repo, options = {} ) {
	await util.readConfigFile( options.cwd );
	const repoUrl = util.parseRepositoryUrl( repo );
	// clone the repo first so it'll be on master, then checkout to the target object.
	// that way we can use the 'master' clone to list tags and so on so we can resolve the correct target without any temporary
	// clones
	let cwd = options.cwd;
	if ( !cwd ) {
		const gitname = util.getGitProjectNameFromUrl( repo );
		cwd = path.join( process.cwd(), gitname || 'project' );
	}
	if ( !options.force && cwd !== '.' && fs.existsSync( cwd ) ) {
		throw new Error( `Target directory ${cwd} already exists!` );
	}
	console.log( util.formatConsoleDependencyName( 'main' ), `Cloning main respository to ${chalk.yellow(cwd)}` );
	await git.clone( repoUrl.url, cwd, { master: true, depth: options.depth } );
	const targetObj = await resolve.getTargetFromRepoUrl( repo, cwd );
	try {
		await git.checkout( cwd, targetObj );
	} catch ( err ) {
		console.error( `Could not checkout target (${targetObj.branch || targetObj.tag || targetObj.commit}). Using 'master'...` );
	}
	console.log( util.formatConsoleDependencyName( 'main' ), `Clone complete, executing update...` );
	options.cwd = cwd;
	options.fromCloneCommand = true;
	await flavio.commands.update( options );
}

export default clone;
