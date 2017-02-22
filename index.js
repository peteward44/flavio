/* eslint-disable */
require( 'babel-register' );
var index = require( './lib' );
var prom = index();
prom.then( function() {
} );
prom.catch( function( err ) {
	console.error( err );
} );
