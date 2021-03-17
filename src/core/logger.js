import winston from 'winston';
import chalk from 'chalk';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const infoColours = {
	'emerg': chalk.red,
	'alert': chalk.red,
	'crit': chalk.red,
	'error': chalk.red,
	'warning': chalk.yellow,
	'notice': chalk.blue,
	'info': chalk.magenta,
	'debug': chalk.gray
};

const paddingBorder = 10;
const paddingNewlineIndent = 3;

function noColour( s ) {
	return s;
}

const myFormat = function( opts ) {
	return winston.format.printf((info) => {
		const {
			timestamp: tmsmp, level, error
		} = info;
		const levelColour = infoColours[level] || noColour;
		let log = `[${levelColour( level )}] `;
		// calculate padding required to align
		const paddingNeeded = Math.max( 0, paddingBorder - ( level.length + 3 ) );
		let paddingNeededForMessage = paddingBorder + paddingNewlineIndent;
		if ( tmsmp ) {
			const timestampString = `${tmsmp} `;
			paddingNeededForMessage += timestampString.length;
			log = `${timestampString}${log}`;
		}
		let padding = '';
		for ( let i=0; i<paddingNeeded; ++i ) {
			padding += ' ';
		}
		let messagePadding = '';
		for ( let i=0; i<paddingNeededForMessage; ++i ) {
			messagePadding += ' ';
		}
		const message = info.message.replace( /\n\s*/g, `\n${messagePadding}` ).trimEnd();
		
		log += `${padding}${message}`;
		
		if ( error ) {
			let errorMessage = ` ${error.message || error}`;
			if ( error.stack && opts?.stack ) {
				errorMessage += `\n${error.stack}`;
			}
			errorMessage = errorMessage.replace( /\n/g, `\n${messagePadding}` ).trimEnd();
			log += ` ${errorMessage}`;
		}
		return log;
	});
};

function getOpenCommand() {
	switch ( process.platform ) {
		case 'darwin':
			return 'open';
		case 'win32':
			return 'start';
		default:
			return 'xdg-open';
	}
}

function openBrowser( uri ) {
	try {
		uri = uri.replace( /&/g, '^&' );
		exec( `${getOpenCommand()} ${uri}` );
	} catch ( err ) {
	}
}

class Logger {
	constructor() {
		this._log = null;
	}

	init( level = 'info' ) {
		try {
			const logRoot = path.join( os.homedir(), '.flavio' );
			fs.ensureDirSync( logRoot );
			const consoleFormat = winston.format.combine( myFormat({ stack: false }) );
			const fileFormat = winston.format.combine( winston.format.timestamp(), myFormat( { stack: true } ), winston.format.uncolorize() );
			this._log = winston.createLogger({
				level,
				transports: [
					new winston.transports.Console( { format: consoleFormat, level: 'info' } ),
					new winston.transports.File({
						format: fileFormat, filename: path.join( logRoot, 'error.log' ), level: 'error', maxsize: 1024 * 1024, maxFiles: 1 
					}),
					new winston.transports.File({
						format: fileFormat, filename: path.join( logRoot, 'combined.log' ), level: 'debug', maxsize: 1024 * 1024, maxFiles: 1 
					})
				]
			});
		} catch ( err ) {
			console.error( err.message );
		}
	}
	
	log( level, ...args ) {
		if ( this._log ) {
			const meta = {};
			let msg = '';
			for ( const arg of args ) {
				if ( arg instanceof Error ) {
					meta.error = arg;
				} else if ( typeof arg === 'string' ) {
					if ( msg.length ) {
						msg += ' ';
					}
					msg += `${arg}`;
				}
			}
			this._log.log( level, msg, meta );
		} else {
			console.log( ...args );
		}
	}
	
	error( msg, err ) {
		if ( this._log ) {
			this._log.error( msg || '', { error: err } );
		} else {
			if ( err ) {
				console.log( err.message );
			}
		}
	}
	
	report() {
		openBrowser( 'mailto:peteward44@gmail.com' );
	}
}

export default new Logger();
