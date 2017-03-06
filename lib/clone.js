import * as util from './util.js';
import * as resolve from './resolve.js';
import caliber from './index.js';

/**
 *
 *
 */
async function clone( repo, options = {} ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	const scm = util.getSCM( repoUrl.scm );
	const targetDesc = await resolve.getTargetDescriptionFromRepoUrl( repo );
	let cwd = options.cwd;
	if ( !cwd ) {
		cwd = path.join( process.cwd(), scm.guessProjectNameFromUrl( repoUrl.url ) );
	}
	await scm.checkout( repoUrl.url, targetDesc, cwd );
	options.cwd = cwd;
	await caliber.commands.install( '', options );
}

export default clone;
