import path from 'path';
import TestRepo from './TestRepo.js';

async function start() {
	const dir = path.join( process.cwd(), 'repo' );
	const result = await TestRepo.create( dir, 'complexNest' );
	
	console.log( `Root repo dir=${result.project.repoDir}` );
	console.log( `Root clone dir=${result.project.checkoutDir}` );
}

start();
