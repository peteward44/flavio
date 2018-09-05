/* eslint-disable */
var index = require( './lib/cli.js' );
var prom = index.default()
.catch( function( err ) {
	console.error( err );
	process.exit( 1 );
} );
