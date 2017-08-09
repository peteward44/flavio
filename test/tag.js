import fs from 'fs';
import path from 'path';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import tag from '../lib/tag.js';
import update from '../lib/update.js';

describe(`tag tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('tag basic', async (tempDir) => {
		// main module
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'this is on the main project'
				}
			]
		});
		
		await tag( { cwd: result.checkoutDir, interactive: false } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
	});

	helpers.test('tag one dependency', async (tempDir) => {
		// main module
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
							path: 'file2.0.2.0.txt',
							contents: 'this is on the main2 project v0.2.0'
						}
					]
				}
			]
		});
		
		await update( { cwd: result.checkoutDir, interactive: false } );
		await tag( { cwd: result.checkoutDir, interactive: false } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.2.0" ) );
	});

	helpers.test('tag two dependencies', async (tempDir) => {
		// main module
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
							path: 'file2.0.2.0.txt',
							contents: 'this is on the main2 project v0.2.0'
						}
					]
				},
				{
					name: 'main3',
					version: '0.3.0-snapshot.0',
					files: [
						{
							path: 'file3.0.3.0.txt',
							contents: 'this is on the main2 project v0.3.0'
						}
					]
				}
			]
		});
		
		await update( { cwd: result.checkoutDir, interactive: false } );
		await tag( { cwd: result.checkoutDir, interactive: false } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.2.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main3' ), "0.3.0" ) );
	});

	helpers.test('Correctly recycle all tags and doesn\'t create new ones when attempting to tag a second time', async (tempDir) => {
		// main module
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
							path: 'file2.0.2.0.txt',
							contents: 'this is on the main2 project v0.2.0'
						}
					]
				},
				{
					name: 'main3',
					version: '0.3.0-snapshot.0',
					files: [
						{
							path: 'file3.0.3.0.txt',
							contents: 'this is on the main2 project v0.3.0'
						}
					]
				}
			]
		});
		
		await update( { cwd: result.checkoutDir, interactive: false } );
		await tag( { cwd: result.checkoutDir, interactive: false } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.2.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main3' ), "0.3.0" ) );

		await tag( { cwd: result.checkoutDir, interactive: false } );

		chai.assert.ok( !( await git.tagExists( result.checkoutDir, "0.2.0" ) ), 'main has no new tag' );
		chai.assert.ok( !( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.3.0" ) ), 'main2 has no new tag' );
		chai.assert.ok( !( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main3' ), "0.4.0" ) ), 'main3 has no new tag' );
	});
	
	helpers.test( 'Correctly recycle a tag on a single dependency and create new ones for any other projects that have been modified', async (tempDir) => {
		// main module
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
							contents: 'this is on the main2 project v0.2.0'
						}
					]
				},
				{
					name: 'main3',
					version: '0.3.0-snapshot.0',
					files: [
						{
							path: 'file3.txt',
							contents: 'this is on the main2 project v0.3.0'
						}
					]
				}
			]
		});
		
		await update( { cwd: result.checkoutDir, interactive: false } );
		await tag( { cwd: result.checkoutDir, interactive: false } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.2.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main3' ), "0.3.0" ) );

		fs.writeFileSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ), 'changes changes changes' );
		await git.addAndCommit( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), 'file2.txt', 'commit message' );
		await git.push( path.join( result.checkoutDir, 'flavio_modules', 'main2' ) );
		
		await tag( { cwd: result.checkoutDir, interactive: false } );

		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.2.0" ), 'main has new tag' );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.3.0" ), 'main2 has new tag' );
		chai.assert.ok( !( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main3' ), "0.4.0" ) ), 'main3 has no new tag' );
	});
});
