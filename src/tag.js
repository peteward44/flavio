import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import inquirer from 'inquirer';
import Table from 'easy-table';
import chalk from 'chalk';
import * as util from './util.js';
import globalConfig from './globalConfig.js';
import checkForConflicts from './checkForConflicts.js';
import * as getSnapshot from './getSnapshot.js';

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
async function getTagPointingAtCurrentHEAD( snapshot ) {
	const target = await snapshot.getTarget();
	if ( target.tag ) {
		// already in detached HEAD state, pointing at a tag
		return target.tag;
	}
	// list all the tags in this repo, and look in each one to see if one of the tags was made on the commit we are currently sat on.
	const lastCommit = await snapshot.getLastCommit();
	let tags = await snapshot.listTags();
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
			const tagFlavioJson = JSON.parse( await snapshot.show( tag, 'flavio.json' ) );
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

async function determineRecycledTagForElement( snapshotRoot, snapshot, recycleTagMap ) {
	// if a node can recycle it's tag, and all of it's dependencies can also recycle their tag, then we can do a recycle.
	if ( !recycleTagMap.has( snapshot.name ) ) {
		const tagName = await getTagPointingAtCurrentHEAD( snapshot );
		recycleTagMap.set( snapshot.name, tagName );
	}
	
	if ( !recycleTagMap.get( snapshot.name ) ) {
		// has no valid tag to recycle - don't bother checking children
		return '';
	}
	
	// check all children to see if they have valid tags
	const children = await snapshot.getChildren( snapshotRoot.deps );
	for ( const depInfo of children.values() ) {
		const childTag = await determineRecycledTagForElement( snapshotRoot, depInfo.snapshot, recycleTagMap );
		if ( !childTag ) {
			// invalid child tag - just report invalid back
			return '';
		}
	}
	
	return recycleTagMap.get( snapshot.name );
}

// makes sure any modules with dependencies have matching versions for those deps in the recycle map
async function validateRecycledTagDependencies( snapshotRoot, snapshot, recycledTag, recycleTagMap ) {
	if ( !recycledTag ) {
		return false;
	}
	// load the flavio.json so we know the dependencies
	const flavioJson = JSON.parse( await snapshot.show( recycledTag, 'flavio.json' ) );
	
	for ( const depName of Object.keys( flavioJson.dependencies ) ) {
		const url = flavioJson.dependencies[depName];
		if ( !recycleTagMap.has( depName ) ) {
			// tag contains depedency we don't have
//			console.log( `Failing ${depName} because not in tag for ${snapshot.name} - ${recycledTag}` );
			return false;
		}
		const repo = util.parseRepositoryUrl( url );
		const childRecycledTag = recycleTagMap.get( depName );
		if ( childRecycledTag !== repo.target ) {
			// Child dependency tag doesn't match the one we have on disk - fail
//			console.log( `Failing ${depName} - ${repo.target} because wrong tag for ${snapshot.name} - ${childRecycledTag}` );
			return false;
		}
	}
	const children = await snapshot.getChildren( snapshotRoot.deps );
	// make sure children match
	if ( children.size !== Object.keys( flavioJson.dependencies ).length ) {
//		console.log( `Failing because dependency count doesn't match: ${snapshot.name} - ${recycledTag}` );
		return false;
	}
	for ( const [depName, depInfo] of children.entries() ) {
		if ( !flavioJson.dependencies.hasOwnProperty( depName ) ) {
			// we have a depedency that the tag doesn't have
//			console.log( `Failing because dependency "${depName}" has been added to: ${snapshot.name} - ${recycledTag}` );
			return false;
		}
		
		// validate the dependencies' dependencies too
		if ( !await validateRecycledTagDependencies( snapshotRoot, depInfo.snapshot, recycleTagMap.get( depName ), recycleTagMap ) ) {
//			console.log( `Failing because dependency "${depName}" children have failed` );
			return false;
		}
	}
	return true;
}

function getNextAvailableVersion( tagList, version, versionType ) {
	let test = version;
	do {
		test = semver.inc( test, versionType );
	} while ( tagList.indexOf( test ) >= 0 );
	return test;
}

async function determineTagName( options, snapshot ) {
	const isInteractive = options.interactive !== false;
	const flavioJson = await snapshot.getFlavioJson();
	if ( _.isEmpty( flavioJson ) ) {
		return null;
	}
	// strip prerelease tag off name
	const tagName = semver.inc( flavioJson.version, options.increment );
	// see if tag of the same name already exists
	const tagList = await snapshot.listTags();
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
				message: util.formatConsoleDependencyName( snapshot.name ) + ` Tag ${tagName} already exists. Use available alternative?`,
				choices: [nextMajor, nextMinor, nextPatch, 'Custom?'],
				default: defaultVal
			};
			const answer = await inquirer.prompt( [question] );
			if ( answer.q === 'Custom?' ) {
				let customAnswer;
				let exists = false;
				do {
					customAnswer = await inquirer.prompt( [{ type: 'input', name: 'q', message: 'Custom tag name?' }] );
					exists = tagList.indexOf( customAnswer.q ) >= 0;
					if ( exists ) {
						console.log( `Tag ${customAnswer.q} already exists` );
					}
				} while ( exists );
				return customAnswer.q;
			} else {
				return answer.q;
			}
		} else {
			return defaultVal;
		}
	}
	return tagName;
}

async function determineTagsRecursive( options, snapshotRoot, snapshot, recycleTagMap, tagMap ) {
	if ( !tagMap.has( snapshot.name ) ) {
		await snapshot.fetch();
		const target = await snapshot.getTarget();
		const recycledTag = await determineRecycledTagForElement( snapshotRoot, snapshot, recycleTagMap );
		const recycledTagsAreValid = await validateRecycledTagDependencies( snapshotRoot, snapshot, recycledTag, recycleTagMap );
		if ( recycledTag && recycledTagsAreValid ) {
			tagMap.set( snapshot.name, {
				tag: recycledTag, originalTarget: target, create: false, dir: snapshot.dir, snapshot
			} );
		} else {
			const tagName = await determineTagName( options, snapshot );
			if ( tagName ) {
				const branchName = `release/${tagName}`;
				const incrementVersion = await snapshot.isUpToDate(); // only increment version in flavio.json if our local HEAD is up to date with the remote branch
				tagMap.set( snapshot.name, {
					tag: tagName, originalTarget: target, branch: branchName, create: true, dir: snapshot.dir, snapshot, incrementMasterVersion: incrementVersion 
				} );
			} else {
				console.log( util.formatConsoleDependencyName( snapshot.name ), `Dependency has no valid flavio.json, so will not be tagged` );
			}
		}
	}
	if ( !options['ignore-dependencies'] ) {
		const children = await snapshot.getChildren( snapshotRoot.deps );
		for ( const depInfo of children.values() ) {
			await determineTagsRecursive( options, snapshotRoot, depInfo.snapshot, recycleTagMap, tagMap );
		}
	}
}

async function determineTags( options, snapshot ) {
	// for every node in the tree, check to see if any of the dependencies are on a branch with change without a tag pointing at the current HEAD
	let recycleTagMap = new Map(); // map of module dir names and a tag they can recycle to, so we don't calculate it multiple times
	let tagMap = new Map(); // map of module dir names and tags which take into account if the children have valid tags too
	await determineTagsRecursive( options, snapshot, snapshot.main, recycleTagMap, tagMap );
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
		const { dir, snapshot } = tagObject;
		if ( tagObject.create ) {
			const lastCommit = await snapshot.getLastCommit();
			await snapshot.checkout( tagObject.branch, true );
			// then modify flavio.json
			let flavioJson = await snapshot.getFlavioJson();
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
			await snapshot.addAndCommit( filesArray, `Commiting new flavio.json for tag ${tagObject.tag}` );
			// then create tag
			await snapshot.createTag( tagObject.tag, `Tag for v${tagObject.tag}` );
			// switch back to original target
			await snapshot.checkout( tagObject.originalTarget.branch || tagObject.originalTarget.tag || tagObject.originalTarget.commit );
		}
	}
}

function incrementMasterVersion( options, version ) {
	const prerelease = semver.prerelease( version );
	return semver.inc( version, `pre${options.increment}`, prerelease ? prerelease[0] : 'snapshot' );
}

async function incrementOriginalVersions( options, reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const { snapshot, dir } = tagObject;
		if ( tagObject.incrementMasterVersion ) {
			// modify flavio.json
			let flavioJson = await snapshot.getFlavioJson();
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
			await snapshot.addAndCommit( filesArray, `Commiting new flavio.json for tag ${tagObject.tag}` );
			await snapshot.push( ['origin', 'HEAD'] );
		}
	}
}

async function pushTags( options, reposToTag ) {
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const { snapshot } = tagObject;
		if ( tagObject.create ) {
			// push release branch
			await snapshot.push( ['origin', `${tagObject.branch}`] );
			// push tag
			await snapshot.push( ['origin', `refs/tags/${tagObject.tag}`] );
		}
	}
}

async function confirmUser( options, reposToTag ) {
	const table = new Table();
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		const target = await tagObject.snapshot.getTarget();
		table.cell( 'Name', name );
		table.cell( 'Target', chalk.magenta( target.commit || target.tag || target.branch ) );
		table.cell( 'Tag', chalk.blue( tagObject.tag ) );
		table.cell( 'New tag?', tagObject.create ? chalk.green( 'YES' ) : chalk.yellow( 'NO' ) );
		table.cell( 'Up to date?', await tagObject.snapshot.isUpToDate() ? chalk.green( 'YES' ) : chalk.red( 'NO' ) );
		table.newRow();
	}
	console.log( table.toString() );
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		if ( tagObject.create && !tagObject.incrementMasterVersion ) {
			console.log( util.formatConsoleDependencyName( name ), `WARNING: Dependency is not up to date with it's upstream branch (${tagObject.originalTarget.branch || tagObject.originalTarget.commit}), and so will not have the flavio.json version automatically incremented` );
		}
	}
	const isInteractive = options.interactive !== false;
	if ( isInteractive ) {
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
	util.defaultOptions( options );
	options.increment = options.increment || 'minor';
	await globalConfig.init( options.cwd );
	await util.readConfigFile( options.cwd );
	console.log( `Inspecting dependencies for tagging operation...` );
	
	const snapshotRoot = await getSnapshot.getSnapshot( options.cwd );
	// make sure there are no conflicts in any dependencies before doing tag
	const conflicts = await checkForConflicts( snapshotRoot, true );
	if ( conflicts.length > 0 ) {
		console.error( `Tag can only be done on projects with no conflicts and no local changes` );
		return;
	}
	
	// work out which repos need to be tagged, and what those tags are going to called
	const reposToTag = await determineTags( options, snapshotRoot );
	let count = 0;
	for ( const [name, tagObject] of reposToTag ) { // eslint-disable-line no-unused-vars
		if ( tagObject.create ) {
			count++;
		}
	}
	// get URL of main project tag so we can print it out once it's finished
	const mainProjectName = await util.getMainProjectName( options.cwd );
	let mainRepoUrl;
	if ( reposToTag.has( mainProjectName ) ) {
		const mainRepo = reposToTag.get( mainProjectName );
		try {
			const url = await mainRepo.snapshot.getBareUrl();
			mainRepoUrl = `${url}#${mainRepo.tag}`;
		} catch ( err ) {}
	} else {
		// main project already tagged?
		const target = await snapshotRoot.main.getTarget();
		if ( target.tag ) {
			const url = await snapshotRoot.main.getBareUrl();
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
