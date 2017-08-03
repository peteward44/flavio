import path from 'path';
import * as util from './util.js';
import * as resolve from './resolve.js';
import * as git from './git.js';
import flavio from './index.js';

/**
 *
 *
 */
async function clone( repo, options = {} ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	// clone the repo first so it'll be on master, then checkout to the target object.
	// that way we can use the 'master' clone to list tags and so on so we can resolve the correct target without any temporary
	// clones
	let cwd = options.cwd;
	if ( !cwd ) {
		const gitname = util.getGitProjectNameFromUrl( repo );
		cwd = path.join( process.cwd(), gitname || 'project' );
	}
	await git.clone( repoUrl.url, cwd, { master: true } );
	const targetObj = await resolve.getTargetFromRepoUrl( repo, cwd );
	await git.checkout( cwd, targetObj );
	options.cwd = cwd;
	await flavio.commands.update( options );
}

export default clone;
