import fs from 'fs-extra';
import path from 'path';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import update from '../lib/update.js';

describe(`install tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('install basic', async (tempDir) => {
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

	helpers.test('install more complicated tree', async (tempDir) => {
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
	

	// helpers.test('update add repo on CLI', async (tempDir) => {
		// const result = await git.addProject( tempDir, {
			// name: 'main',
			// version: '0.1.0-snapshot.0',
			// files: [
				// {
					// path: 'file.txt',
					// contents: 'this is on the main project'
				// }
			// ],
			// modules: [
				// {
					// name: 'main2',
					// version: '0.2.0-snapshot.0',
					// files: [
						// {
							// path: 'file2.txt',
							// contents: 'this is on the main2 project'
						// }
					// ]
				// }
			// ]
		// } );
		// const result2 = await git.addProject( tempDir, {
			// name: 'main3',
			// version: '0.3.0-snapshot.0',
			// files: [
				// {
					// path: 'file3.txt',
					// contents: 'this is on the main3 project'
				// }
			// ],
			// modules: [
				// {
					// name: 'main4',
					// version: '0.4.0-snapshot.0',
					// files: [
						// {
							// path: 'file4.txt',
							// contents: 'this is on the main4 project'
						// }
					// ]
				// }
			// ]
		// } );
		
		// await update( [`main3,${result2.repoDir}#master`], { cwd: result.checkoutDir } );
		// chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
		// chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency installed' );
		// chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main4', 'file4.txt' ) ), 'main4 dependency installed' );
	// });
	
	helpers.test('update basic branch', async (tempDir) => {
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
});
