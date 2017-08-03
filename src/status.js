//import * as depTree from './depTree.js';

// async function printStatus( name, module ) {
	// // TODO: 
	// // git status --porcelain --branch
	// // prints out behind / ahead information
	// /*
// By default no branch information is shown, but if you add the --branch option you will get output like:

// git status --short --branch
// ## master...origin/master [ahead 1]
// ?? untrackedfile.txt
// ...
// If you are up to date (after a fetch), the branch line will just be:

// ## master
// If you are ahead:

// ## master...origin/master [ahead 1]
// If you are behind:

// ## master...origin/master [behind 58]
// And for both:

// ## master...origin/master [ahead 1, behind 58]
	// */
	// console.log( `${name}:` );
	// if ( module.children ) {
		// for ( const [name, child] of module.children ) {
			// await printStatus( name, child );
		// }
	// }
// }

async function status( options ) {
//	const depTree = await depTree.calculate( options );
//	await printStatus( "main", depTree );
}

export default status;
