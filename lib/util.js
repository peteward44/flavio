import fs from 'fs';
import path from 'path';

/**
 * Loads the caliber.json from the given directory. If none exists, returns empty object
 *
 * @param {string} cwd - Working directory
 * @returns {Promise.<Object>} - JSON
 */
export function loadCaliberJson( cwd ) {
	const p = path.join( cwd, 'caliber.json' );
	return new Promise( (resolve, reject) => {
		fs.readFile( p, 'utf-8', (err, txt) => {
			err ? resolve( '{}' ) : resolve( txt );
		} );
	} )
	.then( (txt) => {
		return JSON.parse( txt.toString() );
	} );
}

/**
 * Saves the caliber.json to the given directory
 *
 * @param {string} cwd - Working directory
 * @param {Object} json - New caliber.json data object
 * @returns {Promise}
 */
export function saveCaliberJson( cwd, json ) {
	const p = path.join( cwd, 'caliber.json' );
	return new Promise( (resolve, reject) => {
		fs.saveFile( p, JSON.stringify( json, null, 2 ), 'utf-8', (err) => {
			err ? reject( err ) : resolve();
		} );
	} )
}
