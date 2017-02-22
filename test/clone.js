import os from 'os';
import { svn as svnTransport, git as gitTransport } from 'git-svn-interface';


function defineTests(transport) {
	describe(`${transport.name} clone`, function() {
		this.timeout(30 * 60 * 1000); // 30 minutes

		// helpers.promiseIt('single project checkout, no dependencies', async (tempDir) => {
			// const dir = helpers.createTempFolder(tempDir);
			// const result = await helpers.createRepo(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// files: [
						// {
							// path: 'file.txt',
							// contents: 'this is on the main project'
						// }
					// ],
					// modules: []
				// },
			// );
			// await bowerex.commands.checkout({
				// url: transport.formatBowerDependencyUrl(result.url),
				// cwd: dir,
				// pkgNameRandom: true
			// });
			// const filePath = path.join(dir, 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File exists');
		// });

		// helpers.promiseIt('single project checkout, no dependencies, no bower.json present', async (tempDir) => {
			// const dir = helpers.createTempFolder(tempDir);
			// const result = await helpers.createRepo(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// files: [
						// {
							// path: 'file.txt',
							// contents: 'this is on the main project'
						// }
					// ],
					// nobowerjson: true,
					// modules: []
				// },
			// );
			// await bowerex.commands.checkout({
				// url: transport.formatBowerDependencyUrl(result.url),
				// cwd: dir,
				// pkgNameRandom: true
			// });
			// const filePath = path.join(dir, 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File exists');
		// });

		// helpers.promiseIt('single project checkout, with dependencies', async (tempDir) => {
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
				// cwd: dir,
				// pkgNameRandom: true
			// });
			// const filePath = path.join(dir, 'bower_components', 'dep1', 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File in trunk exists in bower_components');
		// });

		// helpers.promiseIt('single project checkout, with dependencies on branches', async (tempDir) => {
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
							// branch: 'branch1',
							// version: '1.0.0-snapshot.0',
							// files: [
								// {
									// path: 'file.txt',
									// contents: 'this is on a branch'
								// }
							// ]
						// }
					// ]
				// },
			// );
			// await bowerex.commands.checkout({
				// url: transport.formatBowerDependencyUrl(result.url),
				// cwd: dir,
				// pkgNameRandom: true
			// });
			// const filePath = path.join(dir, 'bower_components', 'dep1', 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File in branch exists in bower_components');
		// });

		// helpers.promiseIt('single project install, with dependencies', async (tempDir) => {
			// const result = await helpers.createRepoCheckout(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// checkoutMainOnly: true,
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
			// await bowerex.commands.install([], {
				// cwd: result.checkoutDir,
				// pkgNameRandom: true
			// });
			// const filePath = path.join(result.checkoutDir, 'bower_components', 'dep1', 'file.txt');
			// assert.ok(fs.existsSync(filePath), 'File in exists in bower_components');
		// });


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

