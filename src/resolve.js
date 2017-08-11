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
export async function getTargetFromRepoUrl( repo, localClonePath ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	const tags = await git.listTags( localClonePath );
	const target = repoUrl.target;
	if ( !target ) {
		// none specifed
		// try to get latest tag version
		if ( tags.length > 0 ) {
			const latest = semver.maxSatisfying( tags, '*' );
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
		if ( tags.length > 0 ) {
			if ( semver.validRange( target ) ) {
				const latest = semver.maxSatisfying( tags, target );
				if ( latest ) {
					return {
						tag: latest
					};
				}
			}
			// check if its the name of a tag
			if ( tags.include( target ) ) {
				return {
					tag: target
				};
			}
		}
		// otherwise check if it's the name of a branch
		// TODO: make sure is valid, will need some kind of 'listBranches' or something in git-svn-interface
		return {
			branch: target
		};
	}
}

/**
 * Given array of repository paths, will work out which one will map to the latest version of the package
 *
 * @param {Array.<string>} repos - Array of repository paths in "bower format"
 * @returns {string} - Whichever path in the 'repos' param is the latest version
 */
export async function getLatestVersion( repos ) {
	// TODO:
	return repos[0];
}
