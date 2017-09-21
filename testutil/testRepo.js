// creates a local git repo and allows tests for certain dependencies existing etc.
import fs from 'fs-extra';
import path from 'path';
import * as git from '../lib/git.js';
import chai from 'chai';


class TestRepo {
	/**
	 * @param {Object} descriptor - JSON object describing how the repo will look
	 */
	async init( tempDir, descriptor ) {
		const result = await git.addProject( tempDir, descriptor );
		wait update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ), '' );
	}
	
	/**
	 * Throws an exception if the given dependency target does not match the one supplied
	 */
	assertDependencyTarget( depName, target ) {
	}
	
	
}

export TestRepo;
