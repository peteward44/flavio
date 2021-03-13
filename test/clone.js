import path from 'path';
import * as uuid from 'uuid';
import * as helpers from '../testutil/helpers.js';
import TestRepo from '../testutil/TestRepo.js';
import clone from '../src/commands/clone.js';

describe(`clone tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('clone basic', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'one' );
		const checkoutDir = path.join( tempDir, uuid.v4() );
		const testRepo = new TestRepo( result.project.repoDir, checkoutDir );
		await testRepo.assertDependencyNotExists( 'main' );
		await testRepo.assertDependencyNotExists( 'dep1' );
		await clone( result.project.repoDir, { cwd: checkoutDir } );
		await testRepo.assertDependencyExists( 'main' );
		await testRepo.assertDependencyExists( 'dep1' );
	});

	helpers.test('clone with ignore-dependencies flag set', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'one' );
		const checkoutDir = path.join( tempDir, uuid.v4() );
		const testRepo = new TestRepo( result.project.repoDir, checkoutDir );
		await testRepo.assertDependencyNotExists( 'main' );
		await testRepo.assertDependencyNotExists( 'dep1' );
		await clone( result.project.repoDir, { 'cwd': checkoutDir, 'ignore-dependencies': true } );
		await testRepo.assertDependencyExists( 'main' );
		await testRepo.assertDependencyNotExists( 'dep1' );
	});
});
