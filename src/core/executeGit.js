import fs from 'fs-extra';
import { spawn } from 'child_process';

function printError( err, args, cwd ) {
	let argsString = args.join( " " );
	console.error( `'git ${argsString}'` );
	console.error( `'dir ${cwd}'` );
	console.error( err.stack || err );
}

function executeGit( dir, args, options = {} ) {
	dir = fs.existsSync( dir ) ? dir : process.cwd();
	options = options || {};
	return new Promise( ( resolve, reject ) => {
		let connected = true;
		let stdo = '';
		let stde = '';
		console.log( `Executing git ${args.join(" ")} [dir=${dir}]` );
		let stderr = 'inherit';
		if ( options.captureStderr ) {
			stderr = 'pipe';
		} else if ( options.outputStderr ) {
			stderr = 'inherit';
		}
		let proc = spawn( 'git', args, { cwd: dir, stdio: ['ignore', options.captureStdout ? 'pipe' : 'inherit', stderr] } );

		function unpipe( code ) {
			if ( !connected ) {
				return;
			}
			connected = false;
			if ( code !== 0 && !options.ignoreError ) {
				if ( !options.quiet ) {
					printError( '', args, dir ); // eslint-disable-line no-underscore-dangle
				}
				reject( new Error( "Error running git" ) );
			} else {
				resolve( { out: stdo, err: stde, code: code } );
			}
		}

		if ( options.captureStdout ) {
			proc.stdout.on( 'data', ( data ) => {
				stdo += data.toString();
			} );
		}
		if ( options.captureStderr ) {
			proc.stderr.on( 'data', ( data ) => {
				stde += data.toString();
			} );
		}
		proc.on( 'error', ( err ) => {
			if ( options.ignoreError ) {
				resolve( { out: stdo, err: stde, code: 0 } );
			} else {
				console.log( stde );
				if ( !options.quiet ) {
					printError( err, args, dir );
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
