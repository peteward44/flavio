// Creates a local SVN repositiory using svnadmin to run tests against
import fs from 'fs-extra';
import * as util from '../src/util.js';
import path from 'path';
import os from 'os';
import * as uuid from 'uuid';

// windows paths are too long
const tempRoot = os.platform() === 'win32' ? path.join( path.parse( os.tmpdir() ).root, '.flaviotemp' ) : path.join( os.tmpdir(), 'flavio' );

export function createTempFolder( name ) {
	let p = tempRoot;
	if ( name ) {
		p = path.join( p, name );
	}
	p = path.join( p, uuid.v4() );
	fs.ensureDirSync(p);
	return p;
}

function executeTest( name, func, options ) {
	const tempDir = path.join( tempRoot, uuid.v4() );
	options.linkdir = path.join( tempDir, 'linked' );
	util.overrideDefaultOptions( options );
	try {
		fs.ensureDirSync( tempDir );
		let prom = func( tempDir );
		prom = prom.then(() => {
			// only delete temp folder on successfull test
			try {
				fs.removeSync(tempDir);
			} catch (err) {
				console.error(`Could not delete temp folder for test '${name}'`);
			}
		});
		return prom;
	} catch (err) {
		return Promise.reject(err);
	}
	return Promise.resolve();
}

function doit( harnessIt, that, name, func ) {
	const optionMap = {
		'linked': {
			link: true
		},
		'unlinked': {
			link: false
		}
	};
	for ( const [optionName, options] of Object.entries( optionMap ) ) {
		const fullName = `${name}: ${optionName}`;
		harnessIt( fullName, executeTest.bind( that, fullName, func, options ) );
	}
}

// replacement for mocha's it() method to return a promise instead of accept a callback
export function test(name, func) {
	return doit( it, this, name, func );
}

test.only = function(name, func) {
	return doit( it.only, this, name, func );
};

test.skip = function(name, func) {
	return doit( it.skip, this, name, func );
};
