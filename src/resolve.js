import semver from 'semver';
import * as util from './util.js';
import * as git from './git.js';

/**
 * Returns a target description object used by the git-svn-interface library from a repo url
 *
 * @param {string} repo - Repository path in "bower format"
 * @param {string} localClonePath - Path to directory where a local clone has already been made to prevent temporary checkout
 * @returns {Promise.<TargetDescription>}
 */
export async function getTargetFromRepoUrl( snapshot, repo, localClonePath ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	await snapshot.fetch();
	const tags = await snapshot.listTags();
	const semverTags = tags.filter( semver.valid );
	const { target } = repoUrl;
	if ( !target ) {
		// none specifed
		// try to get latest tag version
		if ( semverTags.length > 0 ) {
			const latest = semver.maxSatisfying( semverTags, '*' );
			return {
				tag: latest
			};
		}
		// if no tags exist, use master branch
		return { branch: "master" };
	} else {
		// target specified
		// check if it's master
		if ( target === 'master' ) {
			return { branch: "master" };
		}
		// check if it's a semver range
		if ( semver.validRange( target ) && semverTags.length > 0 ) {
			const latest = semver.maxSatisfying( semverTags, target );
			if ( latest ) {
				return {
					tag: latest
				};
			}
		}
		if ( tags.length > 0 ) {
			// check if its the name of a tag
			if ( tags.includes( target ) ) {
				return {
					tag: target
				};
			}
		}
		// otherwise check if it's the name of a branch
		if ( await git.doesRemoteBranchExist( repoUrl.url, target ) || await git.doesLocalBranchExist( localClonePath, target ) ) {
			return {
				branch: target
			};
		}
		// then must be a commit hash
		if ( await git.isValidCommit( target ) ) {
			return {
				commit: target
			};
		}
	}
	throw new Error( `resolve.getTargetFromRepoUrl() - Could not determine target for repository URL ${repo}` );
}
