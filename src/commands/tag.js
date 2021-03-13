import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import inquirer from 'inquirer';
import Table from 'easy-table';
import chalk from 'chalk';
import * as util from '../core/util.js';
import globalConfig from '../core/globalConfig.js';
import checkForConflicts from '../core/checkForConflicts.js';
import * as getSnapshot from '../core/getSnapshot.js';
import getRecycledTag from '../tag/getRecycledTag.js';

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
	console.log( `flavioJson=${JSON.stringify( flavioJson )}` );
	if ( _.isEmpty( flavioJson ) ) {
		return null;
	}
	// strip prerelease tag off name
	const tagName = semver.inc( flavioJson.version, 'patch' );
	// see if tag of the same name already exists
	const tagList = await snapshot.listTags();
	if ( tagList.indexOf( tagName ) >= 0 ) {
		// if it already exists, suggest either the next available major, minor or prerelease version for the user to pick
		const defaultVal = getNextAvailableVersion( tagList, tagName, 'patch' );
		if ( isInteractive ) {
			const question = {
				type: 'list',
				name: 'q',
				message: util.formatConsoleDependencyName( snapshot.name ) + ` Tag ${tagName} already exists. Use available alternative?`,
				choices: [defaultVal, 'Custom?'],
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
		const recycledTag = await getRecycledTag( snapshotRoot, snapshot, recycleTagMap );
		if ( recycledTag ) {
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
	return semver.inc( version, `preminor`, prerelease ? prerelease[0] : 'snapshot' );
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
	await globalConfig.init( options.cwd );
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
	const mainProjectName = snapshotRoot.main.name;
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
