/* eslint-disable */
require( 'babel-polyfill' );
var index = require( './lib/cli.js' );
var prom = index.default();
prom.catch( function( err ) {
	console.error( err );
} );
