import path from 'path';
import * as util from './util.js';
import * as resolve from './resolve.js';
import * as git from './git.js';
import caliber from './index.js';

/**
 *
 *
 */
async function clone( repo, options = {} ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	const targetObj = await resolve.getTargetFromRepoUrl( repo );
	let cwd = options.cwd;
	if ( !cwd ) {
		cwd = path.join( process.cwd(), await util.getDependencyNameFromRepoUrl( repo ) );
	}
	await git.clone( repoUrl.url, cwd, targetObj );
	options.cwd = cwd;
	await caliber.commands.install( [], options );
}

export default clone;
