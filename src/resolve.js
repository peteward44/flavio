import semver from 'semver';
import * as util from './util.js';


/**
 * Returns a target description object used by the git-svn-interface library from a repo url
 *
 * @param {string} repo - Repository path in "bower format"
 * @returns {Promise.<TargetDescription>}
 */
export async function getTargetDescriptionFromRepoUrl( repo ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	const scm = util.getSCM( repoUrl.scm );
	const tags = await scm.listTags( repoUrl.url );
	const target = repoUrl.target;
	if ( !target ) {
		// none specifed
		// try to get latest tag version
		if ( tags.length > 0 ) {
			const latest = semver.maxSatisfying( tags, '*' );
			return {
				name: latest,
				type: 'tag'
			};
		}
		// if no tags exist, use 'trunk' (master branch)
		return {
			name: 'trunk',
			type: 'trunk'
		};
	} else {
		// target specified
		// check if it's trunk/master
		if ( ( repoUrl.scm === 'svn' && target === 'trunk' ) || ( repoUrl.scm === 'git' && target === 'master' ) ) {
			return {
				name: 'trunk',
				type: 'trunk'
			};
		}
		// check if it's a semver range
		if ( tags.length > 0 ) {
			if ( semver.validRange( target ) ) {
				const latest = semver.maxSatisfying( tags, target );
				if ( latest ) {
					return {
						name: latest,
						type: 'tag'
					};
				}
			}
			// check if its the name of a tag
			if ( tags.include( target ) ) {
				return {
					name: target,
					type: 'tag'
				};
			}
		}
		// otherwise check if it's the name of a branch
		// TODO: make sure is valid, will need some kind of 'listBranches' or something in git-svn-interface
		return {
			name: target,
			type: 'branch'
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
