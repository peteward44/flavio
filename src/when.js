import fs from 'fs-extra';
import * as _ from 'lodash';
import * as moment from 'moment';
import * as util from './util.js';
import * as git from './git.js';
import * as depTree from './depTree.js';

async function executeRevList( dir, args ) {
	try {
		const out = ( await git.executeGit( ['rev-list', ...args], { cwd: dir, captureStdout: true } ) ).out.trim();
		if ( out ) {
			const fin = out.split( '\n' )[0].trim();
			if ( fin ) {
				return fin;
			}
		}
	} catch ( err ) {
	}
	return '';
}

async function getClosestRevision( dir, date ) {
	const dateString = moment( date ).format( 'YYYY-MM-DD HH:mm' );
	const target = await git.getCurrentTarget( dir );
	const hash = target.branch || target.tag || target.commit;
	
	// first, try getting commit before the given date on the current target
	const a = await executeRevList( dir, ['-n', '1', `--before="${dateString}"`, hash] );
	if ( a ) {
		return a;
	}
	// second, try getting commit before the given date on master
	const b = await executeRevList( dir, ['-n', '1', `--before="${dateString}"`, 'master'] );
	if ( b ) {
		return b;
	}
	// third, try getting commit after the given date on the current target
	const c = await executeRevList( dir, [`--after="${dateString}"`, '--reverse', hash] );
	if ( c ) {
		return c;
	}
	// third, try getting commit after the given date on master
	const d = await executeRevList( dir, [`--after="${dateString}"`, '--reverse', 'master'] );
	if ( d ) {
		return d;
	}
	return '';
}

async function exe( name, dir, date ) {
	if ( fs.existsSync( dir ) ) {
		try {
			const rev = await getClosestRevision( dir, date );
			if ( rev ) {
				await git.executeGit( ['checkout', rev], { cwd: dir } );
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
	await util.readConfigFile( options.cwd );
	
	console.log( `Setting date as ${date.toString()}...` );
	await exe( 'root', options.cwd, date );
	
	const modules = await depTree.listChildren( options );
	console.log( `${modules.size} dependencies found` );
	
	for ( const [name, moduleArray] of modules ) {
		await exe( name, moduleArray[0].dir, date );
	}
}

export default when;
