import fs from 'fs';
import path from 'path';
import * as helpers from '../testutil/helpers.js';
import TestRepo from '../testutil/TestRepo.js';
import * as git from '../src/core/git.js';
import tag from '../src/commands/tag.js';
import tagdep from '../src/commands/tagdep.js';
import update from '../src/commands/update.js';

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

	helpers.test( 'Modify a dependency-of-a-dependency and make sure new tags are created for the main project as well as the 2 dependencies', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'simpleNest' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep2', '0.1.0' );

		// commit change to dep2-1, then make sure new tag is created for main project, dep2, and dep2-1
		fs.writeFileSync( path.join( result.project.checkoutDir, 'flavio_modules', 'dep2-1', 'file2.txt' ), 'changes changes changes' );
		await git.addAndCommit( path.join( result.project.checkoutDir, 'flavio_modules', 'dep2-1' ), 'file2.txt', 'commit message' );
		await git.push( path.join( result.project.checkoutDir, 'flavio_modules', 'dep2-1' ) );

		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.2.0' );
		await result.assertTagExists( 'dep2', '0.2.0' );
		await result.assertTagExists( 'dep2-1', '0.2.0' );
	});
	
	helpers.test( 'Make sure tagging process doesn\'t attempt to recycle a tag with incorrect dependencies', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'simpleNest' );
		
		await update( { cwd: result.project.checkoutDir, interactive: false } );

		console.log( JSON.stringify( result, null, 2 ) );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );
		
		// Create tag of project as a whole (0.1.0)
		await tag( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep2', '0.1.0' );
		
		const dep1Dir = path.join( result.project.checkoutDir, 'flavio_modules', 'dep1' );
		
		fs.writeFileSync( path.join( dep1Dir, 'file2.txt' ), 'changes changes changes' );
		await git.addAndCommit( dep1Dir, 'file2.txt', 'commit message' );
		await git.push( dep1Dir );

		// then create tag of dep1, without re-tagging anything else (0.2.0)
		await tag( { cwd: dep1Dir, interactive: false } );
		
		// so now if we create a new tag of the root project, it should use 0.2.0 of dep1 and create a new tag of the root project,
		// instead of attempting to recycle 0.1.0 of the root project
		await tag( { cwd: result.project.checkoutDir, interactive: false } );
		
		await result.assertTagExists( 'main', '0.2.0' );
		await result.assertTagExists( 'dep1', '0.2.0' );
		await result.assertTagExists( 'dep2', '0.1.0' );
	});

	helpers.test.skip( 'tag when dependency is pointing at a commit', async (tempDir) => {

	});

	helpers.test.skip( 'tag when dependency has previous tags which are not semantic version names', async (tempDir) => {

	});

	helpers.test.skip( 'tag when dependency has previous tags which do not have a flavio.json', async (tempDir) => {

	});
	
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Tagdep tests
	
	helpers.test( 'tagdep command only tags the given dependency', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'one' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );

		await tagdep( { cwd: result.project.checkoutDir, dependency: 'dep1', interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
	});
	
	helpers.test( 'tagdep command only tags the given dependency and it\'s dependencies', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'complexNest' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep1-1', '0.1.0' );
		await result.assertTagNotExists( 'dep1-1-1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );
		await result.assertTagNotExists( 'dep2-1', '0.1.0' );

		await tagdep( { cwd: result.project.checkoutDir, dependency: 'dep1', interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep1-1', '0.1.0' );
		await result.assertTagExists( 'dep1-1-1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );
		await result.assertTagNotExists( 'dep2-1', '0.1.0' );
	});
	
	helpers.test( 'tagdep command only tags the given dependency and it\'s dependencies', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'complexNest' );

		await update( { cwd: result.project.checkoutDir, interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagNotExists( 'dep1-1', '0.1.0' );
		await result.assertTagNotExists( 'dep1-1-1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );
		await result.assertTagNotExists( 'dep2-1', '0.1.0' );

		await tagdep( { cwd: result.project.checkoutDir, dependency: 'dep1-1', interactive: false } );

		await result.assertTagNotExists( 'main', '0.1.0' );
		await result.assertTagNotExists( 'dep1', '0.1.0' );
		await result.assertTagExists( 'dep1-1', '0.1.0' );
		await result.assertTagExists( 'dep1-1-1', '0.1.0' );
		await result.assertTagNotExists( 'dep2', '0.1.0' );
		await result.assertTagNotExists( 'dep2-1', '0.1.0' );
	});

	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Specific version tests (version numbers to use / recycle specified on the command line)
	
	helpers.test.only( 'Specify single version for main repository on the command line', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'none' );

		await result.assertTagNotExists( 'main', '8.9.4' );
		await result.assertTagNotExists( 'main', '0.1.0' );
		
		await tag( { cwd: result.project.checkoutDir, version: "8.9.4", interactive: false } );

		await result.assertTagExists( 'main', '8.9.4' );
		await result.assertTagNotExists( 'main', '0.1.0' );
	});
});
