/* eslint-disable */
require( 'babel-register' );
require( 'babel-polyfill' );
var index = require( './lib/cli.js' );
var prom = index.default();
prom.then( function() {
} );
prom.catch( function( err ) {
	console.error( err );
} );
