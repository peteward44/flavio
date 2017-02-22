/* eslint-disable */
require( 'babel-register' );
var index = require( './lib/cli.js' );
var prom = index();
prom.then( function() {
} );
prom.catch( function( err ) {
	console.error( err );
} );
