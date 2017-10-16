import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as util from './util.js';
import * as git from './git.js';
import * as depTree from './depTree.js';
import checkForConflicts from './checkForConflicts.js';


function areTargetsEqual( lhs, rhs ) {
	if ( lhs.branch && rhs.branch ) {
		return lhs.branch === rhs.branch;
	}
	if ( lhs.tag && rhs.tag ) {
		return lhs.tag === rhs.tag;
	}
	if ( lhs.commit && rhs.commit ) {
		return lhs.commit === rhs.commit;
	}
	return false;
}


// Returns tag name of tag that can be recycled for this repo, or empty string if nothing can be found
async function getTagPointingAtCurrentHEAD( repoDir ) {
	const target = await git.getCurrentTarget( repoDir );
	if ( target.tag ) {
		// already in detached HEAD state, pointing at a tag
		return target.tag;
	}
	// list all the tags in this repo, and look in each one to see if one of the tags was made on the commit we are currently sat on.
	const lastCommit = await git.getLastCommit( repoDir );
	let tags = await git.listTags( repoDir );
	// sort tags by descending version, as we are more likely to be tagging the latest version so it'll be marginally quicker.
	// this sort method puts the invalid semver tags at the end of the array
	tags = tags.sort( ( lhs, rhs ) => {
		const lhsv = semver.valid( lhs );
		const rhsv = semver.valid( rhs );
		if ( lhsv && rhsv ) {
			return semver.rcompare( lhs, rhs );
		} else if ( lhsv ) {
			return -1;
		} else if ( rhsv ) {
			return 1;
		} else {
			return 0;
		}
	} );
	let tagFound = '';
	for ( const tag of tags ) {
		try {
			const tagFlavioJson = JSON.parse( await git.show( repoDir, tag, 'flavio.json' ) );
			if ( _.isObject( tagFlavioJson.tag ) ) {
				// if this object exists in the flavio.json, it means the tag was created by flavio's tagging process previously
				let isEqual = false;
				if ( tagFlavioJson.tag.branch ) {
					// (backwards compatibility with old json)
					isEqual = tagFlavioJson.tag.branch === target.branch;
				} else if ( tagFlavioJson.tag.target ) {
					isEqual = areTargetsEqual( tagFlavioJson.tag.target, target );
				}
				if ( isEqual && tagFlavioJson.tag.commit === lastCommit ) {
					tagFound = tag;
					break;
				}
			}
		} catch ( err ) {}
	}
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


async function determineTagName( options, node ) {
	const isInteractive = options.interactive !== false;
	const flavioJson = await util.loadFlavioJson( node.dir );
	if ( _.isEmpty( flavioJson ) ) {
		return null;
	}
	// strip prerelease tag off name
	const tagName = semver.inc( flavioJson.version, options.increment );
	// see if tag of the same name already exists
	const tagList = await git.listTags( node.dir );
	if ( tagList.indexOf( tagName ) >= 0 ) {
		// if it already exists, suggest either the next available major, minor or prerelease version for the user to pick
		const nextMajor = getNextAvailableVersion( tagList, tagName, 'major' );
		const nextMinor = getNextAvailableVersion( tagList, tagName, 'minor' );
		const nextPatch = getNextAvailableVersion( tagList, tagName, 'patch' );
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
				message: util.formatConsoleDependencyName( node.name ) + ` Tag ${tagName} already exists. Use available alternative?`,
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
		await git.fetch( node.dir );
		const target = await git.getCurrentTarget( node.dir );
		const recycledTag = await determineRecycledTagForElement( node, recycleTagMap );
		if ( recycledTag ) {
			tagMap.set( node.name, { tag: recycledTag, originalTarget: target, create: false, dir: node.dir } );
		} else {
			const tagName = await determineTagName( options, node );
			if ( tagName ) {
				const branchName = `release/${tagName}`;
				const incrementVersion = await git.isUpToDate( node.dir ); // only increment version in flavio.json if our local HEAD is up to date with the remote branch
				tagMap.set( node.name, { tag: tagName, originalTarget: target, branch: branchName, create: true, dir: node.dir, incrementMasterVersion: incrementVersion } );
			} else {
				console.log( util.formatConsoleDependencyName( node.name ), `Dependency has no valid flavio.json, so will not be tagged` );
			}
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

function lockFlavioJson( flavioJson, reposToTag, version, lastCommit, target ) {
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
		target
	};
	return flavioJson;
}

async function writeVersionToJsonFile( pkgJsonPath, version ) {
	if ( fs.existsSync( pkgJsonPath ) ) {
		const pkgJson = JSON.parse( fs.readFileSync( pkgJsonPath, 'utf8' ) );
		pkgJson.version = version;
		fs.writeFileSync( pkgJsonPath, JSON.stringify( pkgJson, null, 2 ), 'utf8' );
		return true;
	}
	return false;
}

async function prepareTags( reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const dir = tagObject.dir;
		if ( tagObject.create ) {
			const lastCommit = await git.getLastCommit( dir );
			await git.createAndCheckoutBranch( dir, tagObject.branch );
			// then modify flavio.json
			let flavioJson = await util.loadFlavioJson( dir );
			flavioJson = lockFlavioJson( flavioJson, reposToTag, tagObject.tag, lastCommit, tagObject.originalTarget );
			await util.saveFlavioJson( dir, flavioJson );
			let filesArray = ['flavio.json'];
			// if there is a package.json or a bower.json, change the version number in those too
			if ( await writeVersionToJsonFile( path.join( dir, 'package.json' ), tagObject.tag ) ) {
				filesArray.push( 'package.json' );
			}
			if ( await writeVersionToJsonFile( path.join( dir, 'bower.json' ), tagObject.tag ) ) {
				filesArray.push( 'bower.json' );
			}
			// commit new flavio.json
			await git.addAndCommit( dir, filesArray, `Commiting new flavio.json for tag ${tagObject.tag}` );
			// then create tag
			await git.createTag( dir, tagObject.tag, `Tag for v${tagObject.tag}` );
			// switch back to original target
			await git.checkout( dir, tagObject.originalTarget );
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
			let filesArray = ['flavio.json'];
			// if there is a package.json or a bower.json, change the version number in those too
			if ( await writeVersionToJsonFile( path.join( dir, 'package.json' ), flavioJson.version ) ) {
				filesArray.push( 'package.json' );
			}
			if ( await writeVersionToJsonFile( path.join( dir, 'bower.json' ), flavioJson.version ) ) {
				filesArray.push( 'bower.json' );
			}
			// commit new flavio.json
			await git.addAndCommit( dir, filesArray, `Commiting new flavio.json for tag ${tagObject.tag}` );
			await git.push( dir, ['origin', 'HEAD'] );
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
			if ( !tagObject.create ) {
				console.log( util.formatConsoleDependencyName( name ), `${tagObject.tag} [${chalk.yellow('REUSE')}]` );
			}
		}
		for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
			if ( tagObject.create ) {
				console.log( util.formatConsoleDependencyName( name ), `${tagObject.tag} [${chalk.magenta('NEW')}]` );
			}
		}
		for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
			if ( tagObject.create && !tagObject.incrementMasterVersion ) {
				console.log( util.formatConsoleDependencyName( name ), `WARNING: Dependency is not up to date with it's upstream branch (${tagObject.originalTarget.branch || tagObject.originalTarget.commit}), and so will not have the flavio.json version automatically incremented` );
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
	await util.readConfigFile( options.cwd );
	console.log( `Inspecting dependencies for tagging operation...` );
	
	const tree = await depTree.traverse( options );
	// make sure there are no conflicts in any dependencies before doing tag
	const isConflicted = await checkForConflicts( options, true );
	if ( isConflicted ) {
		console.error( `Tag can only be done on projects with no conflicts and no local changes` );
		return;
	}
	
	// work out which repos need to be tagged, and what those tags are going to called
	const reposToTag = await determineTags( options, tree );
	let count = 0;
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		if ( tagObject.create ) {
			count++;
		}
	}
	// get URL of main project tag so we can print it out once it's finished
	let mainRepoUrl;
	if ( reposToTag.has( 'main' ) ) {
		const mainRepo = reposToTag.get( 'main' );
		try {
			const url = await git.getWorkingCopyUrl( mainRepo.dir, true );
			mainRepoUrl = `${url}#${mainRepo.tag}`;
		} catch ( err ) {}
	} else {
		// main project already tagged?
		const target = await git.getCurrentTarget( options.cwd );
		if ( target.tag ) {
			const url = await git.getWorkingCopyUrl( options.cwd, true );
			mainRepoUrl = `${url}#${target.tag}`;
		}
	}
	// No tag required - all dependencies have available version to use
	if ( count === 0 ) {
		// print out a version that they should use instead
		console.log( `No valid repositories found to tag` );
		if ( mainRepoUrl ) {
			console.log( `Use ${mainRepoUrl}` );
		}
		return;
	}
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
	
	console.log( `Tagging operation successful`, mainRepoUrl || '' );
}

export default tagOperation;
