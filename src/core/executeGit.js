import fs from 'fs-extra';
import { spawn } from 'child_process';
import logger from './logger.js';

function printError( err, combinedOut, args, cwd, exitCode ) {
	const argsString = args.join( " " );
	logger.log( 'error', `Git command "git ${argsString}" failed [exitCode=${exitCode}] [dir=${cwd}]` );
	if ( err ) {
		logger.log( 'error', err );
	}
	if ( combinedOut ) {
		logger.log( 'error', combinedOut );
	}
}

function executeGit( dir, args, options = {} ) {
	dir = fs.existsSync( dir ) ? dir : process.cwd();
	options = options || {};
	return new Promise( ( resolve, reject ) => {
		let connected = true;
		let stdo = '';
		let stde = '';
		let combined = '';
		logger.log( 'debug', `Executing git ${args.join(" ")} [dir=${dir}]` );
		let proc = spawn( 'git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] } );

		function unpipe( code ) {
			if ( !connected ) {
				return;
			}
			connected = false;
			logger.log( 'debug', combined );
			if ( code !== 0 && !options.ignoreError ) {
				if ( !options.quiet ) {
					printError( '', combined, args, dir, code ); // eslint-disable-line no-underscore-dangle
				}
				reject( new Error( "Error running git" ) );
			} else {
				resolve( { out: stdo, err: stde, code: code } );
			}
		}

		proc.stdout.on( 'data', ( data ) => {
			const s = data.toString();
			stdo += s;
			combined += s;
		} );
		proc.stderr.on( 'data', ( data ) => {
			const s = data.toString();
			stde += s;
			combined += s;
		} );
		proc.on( 'error', ( err ) => {
			if ( options.ignoreError ) {
				resolve( { out: stdo, err: stde, code: 0 } );
			} else {
				if ( !options.quiet ) {
					printError( err, combined, args, dir, 0 );
				}
				reject( new Error( err ) );
			}
		} );
		proc.on( 'exit', ( code ) => {
			unpipe( code );
		} );
		proc.on( 'close', ( code ) => {
			unpipe( code );
		} );
	} );
}

export default executeGit;
