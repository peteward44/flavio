import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { svn as svnTransport, git as gitTransport } from 'git-svn-interface';
import * as helpers from '../testutil/helpers.js';
import caliber from '../';

function defineTests(transport) {
	describe(`${transport.name} install`, function() {
		this.timeout(30 * 60 * 1000); // 30 minutes

		helpers.test('single project install, no dependencies - should complete without doing anything', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					checkoutMainOnly: true,
					files: [
						{
							path: 'file.txt',
							contents: 'this is on the main project'
						}
					],
					modules: []
				}
			);
			await caliber.commands.install(
				'',
				{
					cwd: result.checkoutDir
				}
			);
			const filePath = path.join(result.checkoutDir, 'file.txt');
			assert.ok(fs.existsSync(filePath), 'File exists');
		});

		helpers.test('project install, with 1 dependency', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					checkoutMainOnly: true,
					files: [
						{
							path: 'file.txt',
							contents: 'this is on the main project'
						}
					],
					modules: [
						{
							name: 'dep1',
							version: '1.0.0-snapshot.0',
							files: [
								{
									path: 'file.txt',
									contents: 'this is on a dep'
								}
							]
						}
					]
				}
			);
			await caliber.commands.install(
				'',
				{
					cwd: result.checkoutDir
				}
			);
			const filePath = path.join(result.checkoutDir, 'caliber_modules', 'dep1', 'file.txt');
			assert.ok(fs.existsSync(filePath), 'File exists');
		});

		helpers.test('project install, with a dependency that has dependencies', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					checkoutMainOnly: true,
					files: [
						{
							path: 'file.txt',
							contents: 'this is on the main project'
						}
					],
					modules: [
						{
							name: 'dep1',
							version: '1.0.0-snapshot.0',
							files: [
								{
									path: 'file.txt',
									contents: 'this is on dep1'
								}
							],
							modules: [
								{
									name: 'dep2',
									version: '2.0.0-snapshot.0',
									files: [
										{
											path: 'file2.txt',
											contents: 'this is on dep2'
										}
									]
								}
							]
						}
					]
				}
			);
			await caliber.commands.install(
				'',
				{
					cwd: result.checkoutDir
				}
			);
			const filePath = path.join(result.checkoutDir, 'caliber_modules', 'dep1', 'file.txt');
			assert.ok(fs.existsSync(filePath), 'File exists on 1st level dependency');
			const filePath2 = path.join(result.checkoutDir, 'caliber_modules', 'dep2', 'file2.txt');
			assert.ok(fs.existsSync(filePath2), 'File exists on 2nd level dependency');
		});
		
		helpers.test('project install, with dependencies on branches', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					checkoutMainOnly: true,
					modules: [
						{
							name: 'dep1',
							targetDesc: {
								name: 'branch1',
								type: 'branch'
							},
							version: '1.0.0-snapshot.0',
							files: [
								{
									path: 'file.txt',
									contents: 'this is on a branch'
								}
							]
						}
					]
				},
			);
			await caliber.commands.install(
				'',
				{
					cwd: result.checkoutDir
				}
			);
			const filePath = path.join(result.checkoutDir, 'caliber_modules', 'dep1', 'file.txt');
			assert.ok(fs.existsSync(filePath), 'File exists');
		});
		
		helpers.test('project install, with dependencies on tags', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					checkoutMainOnly: true,
					modules: [
						{
							name: 'dep1',
							targetDesc: {
								name: '1.0.0',
								type: 'tag'
							},
							version: '1.0.0',
							files: [
								{
									path: 'file.txt',
									contents: 'this is on a tag'
								}
							]
						}
					]
				},
			);
			await caliber.commands.install(
				'',
				{
					cwd: result.checkoutDir
				}
			);
			const filePath = path.join(result.checkoutDir, 'caliber_modules', 'dep1', 'file.txt');
			assert.ok(fs.existsSync(filePath), 'File exists');
		});

		// helpers.promiseIt('checkout project on a tag', async (tempDir) => {
			// const result = await helpers.createRepoCheckout(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// modules: [
						// {
							// name: 'dep1',
							// version: '1.0.0-snapshot.0',
							// files: [
								// {
									// path: 'file.txt',
									// contents: 'data'
								// }
							// ]
						// }
					// ]
				// },
			// );
			// await bowerex.commands.tag([], {
				// "cwd": result.checkoutDir,
				// 'config.interactive': false
			// });
			// const checkoutDir = helpers.createTempFolder(tempDir);
			// await bowerex.commands.checkout({
				// cwd: checkoutDir,
				// url: transport.formatBowerDependencyUrl(result.url, {
					// type: 'tag',
					// name: '0.1.0'
				// })
			// });
			// const filePath = path.join(checkoutDir, 'bower_components', 'dep1', 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File in exists in bower_components');
		// });


		// helpers.promiseIt('single project checkout, with dependency that should be automatically linked', async (tempDir) => {
			// const dir = helpers.createTempFolder(tempDir);
			// const result = await helpers.createRepo(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// modules: [
						// {
							// name: 'dep1',
							// version: '1.0.0-snapshot.0',
							// files: [
								// {
									// path: 'file.txt',
									// contents: 'this is on a dep'
								// }
							// ]
						// }
					// ]
				// },
			// );
			// await bowerex.commands.checkout({
				// url: transport.formatBowerDependencyUrl(result.url),
				// cwd: dir
			// });
			// const filePath = path.join(dir, 'bower_checkouts', 'dep1', 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File in trunk exists in bower_components');
		// });

		// it('single project checkout, with dependencies that have dependencies', function(done) {
			// done();
		// } );

		// it('single project checkout, from a branch', function(done) {
			// done();
		// } );

		// it('single project checkout, with dependencies on branches', function(done) {
			// done();
		// } );

		// it('single project checkout, from a tag', function(done) {
			// done();
		// } );

		// it('single project checkout, with dependencies on tags', function(done) {
			// done();
		// } );

		// it('single project checkout, with mixed dependencies', function(done) {
			// done();
		// } );
	});
}

defineTests(svnTransport);
if (os.platform() !== 'win32') {
	defineTests(gitTransport);
}

