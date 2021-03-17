import * as util from './util.js';
import * as getSnapshot from './getSnapshot.js';

async function checkForCorrectRefs( snapshotRoot, snapshot ) {
	const depMap = new Map();
	await getSnapshot.walk( depMap, snapshot, snapshotRoot );
	
	const bustRefs = [];
	for ( const depInfo of depMap.values() ) {
		const url = await depInfo.snapshot.getBareUrl();
		const target = await depInfo.snapshot.getTarget();
		
		const ref = depInfo.refs[0];
		const { url: rurl, target: rtarget } = util.parseRepositoryUrl( ref );
		
		if ( url !== rurl ) {
			bustRefs.push( { snapshot: depInfo.snapshot, urlActual: url, urlExpected: rurl } );
			continue;
		}
		if ( !( target.branch === rtarget || target.tag === rtarget || target.commit === rtarget ) ) {
			bustRefs.push( { snapshot: depInfo.snapshot, targetActual: target.branch || target.tag || target.commit, targetExpected: rtarget } );
			continue;			
		}
	}
	return bustRefs;
}

export default checkForCorrectRefs;
