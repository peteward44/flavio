import fs from 'fs';
import path from 'path';
import * as helpers from '../testutil/helpers.js';
import TestRepo from '../testutil/TestRepo.js';
import * as git from '../lib/git.js';
import tag from '../lib/tag.js';
import update from '../lib/update.js';

describe(`tag tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('tag basic', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'none' );

		await result.assertTagNotExists( 'main', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
	});

	helpers.test('tag one dependency', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'one' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
	});

	helpers.test('tag two dependencies', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'two' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep2', '0.1.0' );
	});

	helpers.test('do not tag dependencies when ignore-dependencies flag is used', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'two' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );

		await tag( { 'cwd': result.project.checkoutDir, 'interactive': false, 'ignore-dependencies': true } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );
	});

	helpers.test('Correctly recycle all tags and doesn\'t create new ones when attempting to tag a second time', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'two' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep2', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.2.0' );
		await result.assertTagNotExists( 'dep1', '0.2.0' );
		await result.assertTagNotExists( 'dep2', '0.2.0' );
	});

	helpers.test( 'Correctly recycle a tag on a single dependency and create new ones for any other projects that have been modified', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'two' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep2', '0.1.0' );

		// commit change to dep2, then make sure new tag is created for main project and dep2, but not dep1
		fs.writeFileSync( path.join( result.project.checkoutDir, 'flavio_modules', 'dep2', 'file2.txt' ), 'changes changes changes' );
		await git.addAndCommit( path.join( result.project.checkoutDir, 'flavio_modules', 'dep2' ), 'file2.txt', 'commit message' );
		await git.push( path.join( result.project.checkoutDir, 'flavio_modules', 'dep2' ) );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.2.0' );
		await result.assertTagExists( 'dep2', '0.2.0' );
		await result.assertTagNotExists( 'dep1', '0.2.0' );
	});

	helpers.test.skip( 'tag when dependency is pointing at a commit', async (tempDir) => {

	});

	helpers.test.skip( 'tag when dependency has previous tags which are not semantic version names', async (tempDir) => {

	});

	helpers.test.skip( 'tag when dependency has previous tags which do not have a flavio.json', async (tempDir) => {

	});
});
