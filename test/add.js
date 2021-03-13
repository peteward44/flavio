import * as helpers from '../testutil/helpers.js';
import TestRepo from '../testutil/TestRepo.js';
import add from '../src/commands/add.js';
import update from '../src/commands/update.js';

describe(`add tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('add basic', async (tempDir) => {
		// main module
		const result = await TestRepo.create( tempDir, 'one' );
		// submodule we are going to add
		const submodule = await TestRepo.create( tempDir, 'none', { name: 'submodule' } );

		await update( { cwd: result.project.checkoutDir } );
		
		await result.assertDependencyExists( 'dep1' );
		await result.assertDependencyNotExists( 'submodule' );
		
		await add( `submodule`, `${submodule.project.repoDir}#master`, { cwd: result.project.checkoutDir } );
		
		await result.assertDependencyExists( 'dep1' );
		await result.assertDependencyExists( 'submodule' );
	});
	
	helpers.test.skip('add branch', async (tempDir) => {
		
	});
	
	helpers.test.skip('add module with other dependencies', async (tempDir) => {
		
	});
});
