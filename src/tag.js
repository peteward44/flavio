import _ from 'lodash';
import path from 'path';
import semver from 'semver';
import * as util from './util.js';
import * as resolve from './resolve.js';
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
	console.log( `node=${node.dir}` );
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
	for ( const [name, module] of node.children ) {
		const childTag = await determineRecycledTagForElement( module, recycleTagMap );
		console.log( `child=${name} tag=${childTag}` );
		if ( !childTag ) {
			// invalid child tag - just report invalid back
			return '';
		}
	}
	
	return recycleTagMap.get( node.dir );
}

async function determineTagsRecursive( node, recycleTagMap, tagMap ) {
	if ( !tagMap.has( node.name ) ) {
		const recycledTag = await determineRecycledTagForElement( node, recycleTagMap );
		if ( recycledTag ) {
			tagMap.set( node.name, { tag: recycledTag, create: false, dir: node.dir } );
		} else {
			const flavioJson = await util.loadFlavioJson( node.dir );
			// strip prerelease tag off name
			const tagName = semver.inc( flavioJson.version, 'minor' );
			const branchName = `release/${tagName}`;
			tagMap.set( node.name, { tag: tagName, branch: branchName, create: true, dir: node.dir } );
		}
	}
	for ( const [name, module] of node.children ) {
		await determineTagsRecursive( module, recycleTagMap, tagMap );
	}
}

async function determineTags( options, tree ) {
	// for every node in the tree, check to see if any of the dependencies are on a branch with change without a tag pointing at the current HEAD
	let recycleTagMap = new Map(); // map of module dir names and a tag they can recycle to, so we don't calculate it multiple times
	let tagMap = new Map(); // map of module dir names and tags which take into account if the children have valid tags too
	await determineTagsRecursive( tree, recycleTagMap, tagMap );
	console.log( `recycleTagMap: ${JSON.stringify( recycleTagMap, null, 2 )}` );
	console.log( `=====================================================================` );
	console.log( `tagMap: ${JSON.stringify( tagMap, null, 2 )}` );
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
	for ( const [name, tagObject] of reposToTag ) {
		const dir = tagObject.dir;
		if ( tagObject.create ) {
			const target = await git.getCurrentTarget( dir );
			const branchName = target.branch;
			const lastCommit = await git.getLastCommit( dir );
			await git.createAndCheckoutBranch( dir, tagObject.branch );
			// then modify flavio.json
			let flavioJson = await util.loadFlavioJson( dir );
			flavioJson = lockFlavioJson( flavioJson, reposToTag, tagObject.tag, lastCommit, branchName );
			await util.saveFlavioJson( dir, flavioJson );
			// commit new flavio.json
			await git.addAndCommit( dir, 'flavio.json', `Commiting new flavio.json for tag ${tagObject.tag}` );
			// then create tag
			await git.createTag( dir, tagObject.tag, `Tag for v${tagObject.tag}` );
			// switch back to original branch
			await git.checkout( dir, target );
		}
	}
}

async function pushTags( options, reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) {
		const dir = tagObject.dir;
		if ( tagObject.create ) {
			// push release branch
			await git.push( dir, ['origin', `${tagObject.branch}`] );
			// push tag
			await git.push( dir, ['origin', `refs/tags/${tagObject.tag}`] );
		}
	}
}

/**
 *
 *
 */
async function tag( options = {} ) {
	const tree = await depTree.traverse( options );
	// TODO: disallow a tag operation if there are any local changes?

	// work out which repos need to be tagged, and what those tags are going to called
	const reposToTag = await determineTags( options, tree );
	// create releae branches + tags, modify flavio.json
	await prepareTags( reposToTag );
	// then push everything
	await pushTags( options, reposToTag );
}

export default tag;
