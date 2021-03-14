import path from 'path';
import fs from 'fs';
import TestRepo from '../../testutil/TestRepo.js';

function getTargetDirectory( cwd, baseName ) {
	let attempt = 0;
	let fullPath;
	do {
		if ( attempt > 1000 ) {
			// failsafe to prevent infinite loop
			throw new Error( `Could not determine name for target directory` );
		}
		const name = attempt > 0 ? `${baseName}-${attempt.toString().padStart( 3, '0' )}` : baseName;
		fullPath = path.join( cwd, name );
		attempt++;
	} while ( fs.existsSync( fullPath ) );
	return fullPath;
}

async function testMakeRepo( options ) {
	const dir = getTargetDirectory( options.cwd, 'testrepo' );
	const result = await TestRepo.create( dir, options.template );
	
	console.log( `Created ${path.basename( dir )}` );
	console.log( `Root repo dir=${result.project.repoDir}` );
	console.log( `Root clone dir=${result.project.checkoutDir}` );
}

export default testMakeRepo;
