import * as _ from 'lodash';
import * as moment from 'moment';
import * as util from './util.js';
import globalConfig from './globalConfig.js';
import * as getSnapshot from './getSnapshot.js';

async function getClosestRevision( snapshot, date ) {
	const dateString = moment( date ).format( 'YYYY-MM-DD HH:mm' );
	const target = await snapshot.getTarget();
	const hash = target.branch || target.tag || target.commit;
	
	// first, try getting commit before the given date on the current target
	const a = await snapshot.executeRevList( ['-n', '1', `--before="${dateString}"`, hash] );
	if ( a ) {
		return a;
	}
	// second, try getting commit before the given date on master
	const b = await snapshot.executeRevList( ['-n', '1', `--before="${dateString}"`, 'master'] );
	if ( b ) {
		return b;
	}
	// third, try getting commit after the given date on the current target
	const c = await snapshot.executeRevList( [`--after="${dateString}"`, '--reverse', hash] );
	if ( c ) {
		return c;
	}
	// third, try getting commit after the given date on master
	const d = await snapshot.executeRevList( [`--after="${dateString}"`, '--reverse', 'master'] );
	if ( d ) {
		return d;
	}
	return '';
}

async function exe( name, snapshot, date ) {
	if ( await snapshot.getStatus() === 'installed' ) {
		try {
			const rev = await getClosestRevision( snapshot, date );
			if ( rev ) {
				await snapshot.checkout( rev );
				console.log( `${name} set successfully to rev ${rev}` );
			} else {
				console.log( `${name} could not find appropriate revision for given date, leaving as is...` );
			}
		} catch ( err ) {
			console.error( `Error executing when command` );
			console.error( err );
		}
	}
}

/**
 *
 *
 */
async function when( date, options = {} ) {
	if ( !_.isString( options.cwd ) ) {
		throw new Error( `Invalid cwd argument ${options.cwd}` );
	}
	util.defaultOptions( options );
	await globalConfig.init( options.cwd );
	
	const snapshot = await getSnapshot.getSnapshot( options.cwd );
	
	console.log( `Setting date as ${date.toString()}...` );
	await exe( 'root', snapshot.main, date );
	
	//console.log( `${modules.size} dependencies found` );
	for ( const [name, depInfo] of snapshot.deps.entries() ) {
		await exe( name, depInfo.snapshot, date );
	}
}

export default when;
