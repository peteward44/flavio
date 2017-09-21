import fs from 'fs-extra';
import path from 'path';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import * as util from '../lib/util.js';
import update from '../lib/update.js';

describe(`update tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes
	
	helpers.test('no dependencies', async (tempDir) => {
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
			]
		} );
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ), '' );
	});
	
	helpers.test('one dependency', async (tempDir) => {
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
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
	});

	helpers.test('more complicated tree', async (tempDir) => {
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
					],
					modules: [
						{
							name: 'main3',
							version: '0.3.0-snapshot.0',
							files: [
								{
									path: 'file3.txt',
									contents: 'this is on the main3 project'
								}
							],
							modules: [
								{
									name: 'main4',
									version: '0.4.0-snapshot.0',
									files: [
										{
											path: 'file4.txt',
											contents: 'this is on the main4 project'
										}
									]
								}
							]
						}
					]
				},
				{
					name: 'main5',
					version: '0.5.0-snapshot.0',
					files: [
						{
							path: 'file5.txt',
							contents: 'this is on the main5 project'
						}
					],
					modules: [
						{
							name: 'main6',
							version: '0.6.0-snapshot.0',
							files: [
								{
									path: 'file6.txt',
									contents: 'this is on the main6 project'
								}
							]
						}
					]
				}
			]
		} );
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main4', 'file4.txt' ) ), 'main4 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main5', 'file5.txt' ) ), 'main5 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main6', 'file6.txt' ) ), 'main6 dependency installed' );		
	});
	
	helpers.test('conflict between same repo with different versions resolved automatically', async (tempDir) => {
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
					version: '0.1.0',
					tag: '0.1.0',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project v0.1.0'
						}
					]
				},
				{
					name: 'main3',
					version: '0.2.0',
					files: [
						{
							path: 'file3.txt',
							contents: 'this is on the main2 project v0.2.0'
						}
					],
					modules: [
						{
							name: 'main2',
							version: '0.2.0',
							tag: '0.2.0',
							files: [
								{
									path: 'file2.txt',
									contents: 'this is on the main2 project v0.2.0'
								}
							]
						}
					]
				}
			]
		} );
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency installed' );
	});
	
	helpers.test('conflict between same repo with different versions resolved automatically when force-latest is true, and is switched correctly when version is changed', async (tempDir) => {
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
					version: '1.1.0',
					tag: '1.1.0',
					files: [
						{
							path: 'file2.1.1.0.txt',
							contents: 'this is on the main2 project v0.1.0'
						}
					]
				},
				{
					name: 'main3',
					version: '0.2.0',
					files: [
						{
							path: 'file3.txt',
							contents: 'this is on the main2 project v0.2.0'
						}
					],
					modules: [
						{
							name: 'main2',
							version: '0.2.0',
							tag: '0.2.0',
							files: [
								{
									path: 'file2.0.2.0.txt',
									contents: 'this is on the main2 project v0.2.0'
								}
							]
						}
					]
				}
			]
		} );
		// do force-latest to make sure we get v1.1.0 of main2
		await update( { 'cwd': result.checkoutDir, 'force-latest': true } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.1.1.0.txt' ) ), 'main2 dependency installed' );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.0.2.0.txt' ) ), 'main2 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency installed' );
		
		// now change main2 reference in root flavio.json to 0.2.0, and see if that works
		const rootFlavioJson = JSON.parse( fs.readFileSync( path.join( result.checkoutDir, 'flavio.json' ), 'utf8' ) );
		const main2url = util.parseRepositoryUrl( rootFlavioJson.dependencies.main2 );
		rootFlavioJson.dependencies.main2 = `${main2url.url}#0.2.0`;
		fs.writeFileSync( path.join( result.checkoutDir, 'flavio.json' ), JSON.stringify( rootFlavioJson, null, 2 ), 'utf8' );
		
		await update( { 'cwd': result.checkoutDir, 'force-latest': true, 'switch': true } );
		
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.1.1.0.txt' ) ), 'main2 is not 1.1.0' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.0.2.0.txt' ) ), 'main2 is 0.2.0' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency installed' );
	});
	
	helpers.test('remote-reset flag resets the branch on a module which has a missing upstream branch', async (tempDir) => {
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
					branch: 'my_branch',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project v0.1.0'
						}
					]
				}
			]
		} );
		// set up first
		await update( { 'cwd': result.checkoutDir } );
		
		await git.deleteRemoteBranch( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), 'my_branch' );
		
		// then this should perform branch reset on main2 to master
		await update( { 'cwd': result.checkoutDir, 'remote-reset': true } );
	
		chai.assert.equal( ( await git.getCurrentTarget( path.join( result.checkoutDir, 'flavio_modules', 'main2' ) ) ).branch, 'master', 'main3 dependency installed' );
	});
	
	helpers.test('one dependency on a branch', async (tempDir) => {
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
					branch: 'branchname',
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
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
	});
	
	helpers.test('one dependency on a specific commit', async (tempDir) => {
		
	});
});
