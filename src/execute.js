import * as depTree from './depTree.js';
import * as util from './util.js';
import * as git from './git.js';


function exe( name, dir, args ) {
	console.log( `${name}: "git ${args.join( " " )}"` );
	return git.executeGit( args, { cwd: dir, outputStderr: true } );
}


async function execute( options ) {
	await util.readConfigFile( options.cwd );
	const args = options._.slice( 1 ); // "execute" will appear as first element in array
	if ( args.length === 0 ) {
		console.error( `No command specified for execute command. Usage: flavio execute -- status` );
		return;
	}
	await exe( 'root', options.cwd, args );
	
	const modules = await depTree.listChildren( options );
	console.log( `${modules.size} dependencies found` );
	
	for ( const [name, moduleArray] of modules ) {
		await exe( name, moduleArray[0].dir, args );
	}
}

export default execute;
