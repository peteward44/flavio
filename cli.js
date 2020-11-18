/* eslint-disable */
require( 'core-js/stable' );
require( 'regenerator-runtime/runtime' );
//require( '@babel/register' );
var index = require( './src/cli.js' );
var prom = index.default()
.catch( function( err ) {
	console.error( err.stack || err );
	process.exit( 1 );
} );
