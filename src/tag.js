import _ from 'lodash';
import semver from 'semver';
import inquirer from 'inquirer';
import * as util from './util.js';
import * as git from './git.js';
import * as depTree from './depTree.js';


// Returns tag name of tag that can be recycled for this repo, or empty string if nothing can be found
async function getTagPointingAtCurrentHEAD( repoDir ) {
	const target = await git.getCurrentTarget( repoDir );
	if ( target.tag ) {
		// already in detached HEAD state, pointing at a tag
		return target.tag;
	}
	// list all the tags in this repo, and look in each one to see if one of the tags was made on the commit we are currently sat on.
	const branchName = target.branch;
	const lastCommit = await git.getLastCommit( repoDir );
	const tags = await git.listTags( repoDir );
	let tagFound = '';
	for ( const tag of tags ) {
		await git.checkout( repoDir, { tag: tag } );
		const tagFlavioJson = await util.loadFlavioJson( repoDir );
		if ( _.isObject( tagFlavioJson.tag ) ) {
			// if this object exists in the flavio.json, it means the tag was created by flavio's tagging process previously
			if ( tagFlavioJson.tag.branch === branchName && tagFlavioJson.tag.commit === lastCommit ) {
				tagFound = tag;
				break;
			}
		}
	}
	// switch back to original branch
	await git.checkout( repoDir, target );
	return tagFound;
}


async function determineRecycledTagForElement( node, recycleTagMap ) {
	// if a node can recycle it's tag, and all of it's dependencies can also recycle their tag, then we can do a recycle.
	if ( !recycleTagMap.has( node.dir ) ) {
		const tagName = await getTagPointingAtCurrentHEAD( node.dir );
		recycleTagMap.set( node.dir, tagName );
	}
	
	if ( !recycleTagMap.get( node.dir ) ) {
		// has no valid tag to recycle - don't bother checking children
		return '';
	}
	
	// check all children to see if they have valid tags
	for ( const [name, module] of node.children ) { // eslint-disable-line no-unused-vars
		const childTag = await determineRecycledTagForElement( module, recycleTagMap );
		if ( !childTag ) {
			// invalid child tag - just report invalid back
			return '';
		}
	}
	
	return recycleTagMap.get( node.dir );
}


function getNextAvailableVersion( tagList, version, versionType ) {
	let test = version;
	do {
		test = semver.inc( test, versionType );
	} while ( tagList.indexOf( test ) >= 0 );
	return test;
}


async function determineTagName( options, dir ) {
	const isInteractive = options.interactive !== false;
	const flavioJson = await util.loadFlavioJson( dir );
	// strip prerelease tag off name
	const tagName = semver.inc( flavioJson.version, options.increment );
	// see if tag of the same name already exists
	const tagList = await git.listTags( dir );
	if ( tagList.indexOf( tagName ) ) {
		// if it already exists, suggest either the next available major, minor or prerelease version for the user to pick
		const nextMajor = getNextAvailableVersion( tagList, tagName, 'major' );
		const nextMinor = getNextAvailableVersion( tagList, tagName, 'minor' );
		const nextPatch = getNextAvailableVersion( tagList, tagName, 'patch' );
		console.log( "nextMajor", nextMajor, "nextMinor", nextMinor, "nextPatch", nextPatch );
		let defaultVal;
		switch ( options.increment ) {
			case 'major':
				defaultVal = nextMajor;
				break;
			default:
			case 'minor':
				defaultVal = nextMinor;
				break;
			case 'patch':
				defaultVal = nextPatch;
				break;
		}
		if ( isInteractive ) {
			const question = {
				type: 'list',
				name: 'q',
				message: `Tag ${tagName} already exists. Use available alternative?`,
				choices: [nextMajor, nextMinor, nextPatch],
				default: defaultVal
			};
			const answer = await inquirer.prompt( [question] );
			return answer.q;
		} else {
			return defaultVal;
		}
	}
	return tagName;
}

async function determineTagsRecursive( options, node, recycleTagMap, tagMap ) {
	if ( !tagMap.has( node.name ) ) {
		const target = await git.getCurrentTarget( node.dir );
		const originalBranch = target.branch;
		const recycledTag = await determineRecycledTagForElement( node, recycleTagMap );
		if ( recycledTag ) {
			tagMap.set( node.name, { tag: recycledTag, originalBranch, create: false, dir: node.dir } );
		} else {
			const tagName = await determineTagName( options, node.dir );
			const branchName = `release/${tagName}`;
			const incrementVersion = await git.isUpToDate( node.dir ); // only increment version in flavio.json if our local HEAD is up to date with the remote branch
			tagMap.set( node.name, { tag: tagName, originalBranch, branch: branchName, create: true, dir: node.dir, incrementMasterVersion: incrementVersion } );
		}
	}
	for ( const [name, module] of node.children ) { // eslint-disable-line no-unused-vars
		await determineTagsRecursive( options, module, recycleTagMap, tagMap );
	}
}

async function determineTags( options, tree ) {
	// for every node in the tree, check to see if any of the dependencies are on a branch with change without a tag pointing at the current HEAD
	let recycleTagMap = new Map(); // map of module dir names and a tag they can recycle to, so we don't calculate it multiple times
	let tagMap = new Map(); // map of module dir names and tags which take into account if the children have valid tags too
	await determineTagsRecursive( options, tree, recycleTagMap, tagMap );
	return tagMap;
}

function lockFlavioJson( flavioJson, reposToTag, version, lastCommit, branchName ) {
	// change version
	flavioJson.version = version;
	// lock all dependency versions
	if ( flavioJson.dependencies ) {
		for ( const name of Object.keys( flavioJson.dependencies ) ) {
			if ( reposToTag.has( name ) ) {
				const repo = flavioJson.dependencies[name];
				const repoUrl = util.parseRepositoryUrl( repo );
				const newTagName = reposToTag.get( name ).tag;
				flavioJson.dependencies[name] = `${repoUrl.url}#${newTagName}`;
			}
		}
	}
	// add commit SHA and branch name
	flavioJson.tag = {
		commit: lastCommit,
		branch: branchName
	};
	return flavioJson;
}

async function prepareTags( reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const dir = tagObject.dir;
		if ( tagObject.create ) {
			const lastCommit = await git.getLastCommit( dir );
			await git.createAndCheckoutBranch( dir, tagObject.branch );
			// then modify flavio.json
			let flavioJson = await util.loadFlavioJson( dir );
			flavioJson = lockFlavioJson( flavioJson, reposToTag, tagObject.tag, lastCommit, tagObject.originalBranch );
			await util.saveFlavioJson( dir, flavioJson );
			// commit new flavio.json
			await git.addAndCommit( dir, 'flavio.json', `Commiting new flavio.json for tag ${tagObject.tag}` );
			// then create tag
			await git.createTag( dir, tagObject.tag, `Tag for v${tagObject.tag}` );
			// switch back to original branch
			await git.checkout( dir, { branch: tagObject.originalBranch } );
		}
	}
}

function incrementMasterVersion( options, version ) {
	const prerelease = semver.prerelease( version );
	return semver.inc( version, `pre${options.increment}`, prerelease ? prerelease[0] : 'snapshot' );
}

async function incrementOriginalVersions( options, reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const dir = tagObject.dir;
		if ( tagObject.incrementMasterVersion ) {
			// modify flavio.json
			let flavioJson = await util.loadFlavioJson( dir );
			flavioJson.version = incrementMasterVersion( options, flavioJson.version );
			await util.saveFlavioJson( dir, flavioJson );
			// commit new flavio.json
			await git.addAndCommit( dir, 'flavio.json', `Commiting new flavio.json for tag ${tagObject.tag}` );
		}
	}
}

async function pushTags( options, reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const dir = tagObject.dir;
		if ( tagObject.create ) {
			// push release branch
			await git.push( dir, ['origin', `${tagObject.branch}`] );
			// push tag
			await git.push( dir, ['origin', `refs/tags/${tagObject.tag}`] );
		}
	}
}

async function confirmUser( options, reposToTag ) {
	const isInteractive = options.interactive !== false;
	if ( isInteractive ) {
		for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
			if ( tagObject.create ) {
				console.log( `${name}: ${tagObject.tag}` );
			}
		}
		for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
			if ( tagObject.create && !tagObject.incrementMasterVersion ) {
				console.log( `WARNING: ${name} is not up to date with it's upstream branch (${tagObject.originalBranch}), and so will not have the flavio.json version automatically incremented` );
			}
		}
		const question = {
			type: 'confirm',
			name: 'q',
			message: `Commit changes?`
		};
		const answer = await inquirer.prompt( [question] );
		return answer.q;
	}
	return true;
}


/**
 *
 *
 */
async function tagOperation( options = {} ) {
	options.increment = options.increment || 'minor';
	const tree = await depTree.traverse( options );
	// TODO: disallow a tag operation if there are any local changes?

	// work out which repos need to be tagged, and what those tags are going to called
	const reposToTag = await determineTags( options, tree );
	// confirm with user the values to tag
	if ( !( await confirmUser( options, reposToTag ) ) ) {
		return;
	}
	// increment version number on the original branch first
	await incrementOriginalVersions( options, reposToTag );
	// create release branches + tags, modify flavio.json
	await prepareTags( reposToTag );
	// then push everything
	await pushTags( options, reposToTag );
}

export default tagOperation;
