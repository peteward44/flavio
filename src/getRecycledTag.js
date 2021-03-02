import _ from 'lodash';
import semver from 'semver';
import * as util from './util.js';

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

async function getRecycledTag( snapshotRoot, snapshot, recycleTagMap ) {
	const recycledTag = await determineRecycledTagForElement( snapshotRoot, snapshot, recycleTagMap );
	const recycledTagsAreValid = await validateRecycledTagDependencies( snapshotRoot, snapshot, recycledTag, recycleTagMap );
	if ( recycledTag && recycledTagsAreValid ) {
		return recycledTag;
	}
	return null;
}

export default getRecycledTag;
