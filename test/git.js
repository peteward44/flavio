import fs from 'fs-extra';
import path from 'path';
import uuid from 'uuid';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';

describe(`git tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('createRepo basic', async (tempDir) => {
		const repoDir = path.join( tempDir, uuid.v4() );
		const checkoutDir = path.join( tempDir, uuid.v4() );
		await git.createRepo( repoDir, checkoutDir );
		chai.assert.ok( fs.existsSync( path.join( checkoutDir, '.git' ) ), 'Checkout directory contains .git folder' );
		// TODO: verify we are on master
	});
	
	helpers.test('createRepo branch', async (tempDir) => {
		const repoDir = path.join( tempDir, uuid.v4() );
		const checkoutDir = path.join( tempDir, uuid.v4() );
		await git.createRepo( repoDir, checkoutDir, { branch: 'branchname' } );
		chai.assert.ok( fs.existsSync( path.join( checkoutDir, '.git' ) ), 'Checkout directory contains .git folder' );
		// TODO: verify branch was created
	});
	
	helpers.test('createRepo tag', async (tempDir) => {
		const repoDir = path.join( tempDir, uuid.v4() );
		const checkoutDir = path.join( tempDir, uuid.v4() );
		await git.createRepo( repoDir, checkoutDir, { tag: 'tagname' } );
		chai.assert.ok( fs.existsSync( path.join( checkoutDir, '.git' ) ), 'Checkout directory contains .git folder' );
		// TODO: verify tag was created
	});
	
	helpers.test('cat basic', async (tempDir) => {
		const repoDir = path.join( tempDir, uuid.v4() );
		const checkoutDir = path.join( tempDir, uuid.v4() );
		await git.createRepo( repoDir, checkoutDir, { files: [{ path: 'file.txt', contents: 'file contents' }] } );
		const contents = await git.cat( repoDir, 'file.txt' );
		chai.assert.equal( contents, 'file contents' );
		// TODO: tag/branch versions
	});
	
	helpers.test('addProject basic', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'this is on the main project'
				}
			],
			modules: []
		} );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, '.git' ) ), 'Checkout directory contains .git folder' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ), 'Checkout directory contains file.txt' );
		chai.assert.equal( fs.readFileSync( path.join( result.checkoutDir, 'file.txt' ) ), 'this is on the main project', 'File.txt contains correct text' );
		// TODO: perform checks on remote git repo that the files exist
	} );
	
	helpers.test('addProject basic with 1 dependency', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'this is on the main project'
				}
			],
			modules: [
				{
					name: 'main2',
					version: '0.2.0-snapshot.0',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project'
						}
					]
				}
			]
		} );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, '.git' ) ), 'Checkout directory contains .git folder' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ), 'Checkout directory contains file.txt' );
		chai.assert.equal( fs.readFileSync( path.join( result.checkoutDir, 'file.txt' ) ), 'this is on the main project', 'File.txt contains correct text' );

		chai.assert.ok( fs.existsSync( path.join( result.alldeps.main2.checkoutDir, '.git' ) ), 'Checkout directory contains .git folder' );
		chai.assert.ok( fs.existsSync( path.join( result.alldeps.main2.checkoutDir, 'file2.txt' ) ), 'Checkout directory contains file2.txt' );
		chai.assert.equal( fs.readFileSync( path.join( result.alldeps.main2.checkoutDir, 'file2.txt' ) ), 'this is on the main2 project', 'File2.txt contains correct text' );
		// TODO: perform checks on remote git repo that the files exist
	} );
	
	// TODO: addProject branches, tags, more complicated trees
	// TODO: listTags
	// TODO: clone
});
