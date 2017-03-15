import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { svn as svnTransport, git as gitTransport } from 'git-svn-interface';
import * as helpers from '../testutil/helpers.js';
import caliber from '../';

function defineTests(transport) {
	describe(`${transport.name} tag`, function() {
		this.timeout(30 * 60 * 1000); // 30 minutes

		helpers.test('single project tag, no dependencies', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					modules: []
				},
			);
			await caliber.commands.tag([], {
				"cwd": result.checkoutDir,
				'config.interactive': false
			});
			const exists = await transport.exists(result.url, { type: 'tag', name: '0.1.0' }, 'caliber.json');
			assert.equal(exists, true, 'Tag has been created for main project');
		});

		// helpers.promiseIt('single project tag, no dependencies, no bower.json', async (tempDir) => {
			// const result = await helpers.createRepoCheckout(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// nobowerjson: true,
					// modules: [],
					// files: [
						// {
							// path: 'file.txt',
							// contents: 'this is on the main project'
						// }
					// ]
				// },
			// );
			// await bowerex.commands.tag([], {
				// "cwd": result.checkoutDir,
				// 'config.interactive': false
			// });
			// const exists = await transport.exists(result.url, { type: 'tag', name: '1.0.0' }, 'file.txt');
			// assert.equal(exists, true, 'Tag has been created for main project');
		// });

		// helpers.promiseIt('single project tag, external dependencies only', async (tempDir) => {
			// const result = await helpers.createRepoCheckout(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// modules: [
						// {
							// name: 'underscore',
							// version: '*',
							// external: true
						// }
					// ]
				// },
			// );
			// await bowerex.commands.tag([], {
				// "cwd": result.checkoutDir,
				// 'config.interactive': false
			// });
			// const exists = await transport.exists(result.url, { type: 'tag', name: '0.1.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for main project');
		// });


		// helpers.promiseIt('single project tag, with dependencies', async (tempDir) => {
			// const result = await helpers.createRepoCheckout(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// modules: [
						// {
							// name: 'dep1',
							// version: '1.0.0-snapshot.0'
						// }
					// ]
				// },
			// );
			// await bowerex.commands.tag([], {
				// "cwd": result.checkoutDir,
				// 'config.interactive': false
			// });
			// let exists = await transport.exists(result.url, { type: 'tag', name: '0.1.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for main project');
			// exists = await transport.exists(result.deps.dep1.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');
			// // verify bower.json contents
			// const bowerJsonOk = await helpers.verifyBowerJson(
				// transport,
				// [
					// { // check tagged project json
						// name: 'main',
						// source: { url: result.url, targetDesc: { type: 'tag', name: '0.1.0' } },
						// test: {
							// version: '0.1.0',
							// deps: [
								// {
									// name: 'dep1',
									// url: transport.formatBowerDependencyUrl(result.deps.dep1.url, { type: 'tag', name: '1.0.0' })
								// }
							// ]
						// }
					// },
					// { // check dependency json
						// name: 'dep1',
						// source: { url: result.deps.dep1.url, targetDesc: { type: 'tag', name: '1.0.0' } },
						// test: {
							// version: '1.0.0'
						// }
					// },
					// { // check trunk bower.json
						// name: 'main trunk',
						// source: { url: result.url },
						// test: {
							// version: '0.2.0-snapshot.0'
						// }
					// },
					// { // check trunk bower.json on dep1
						// name: 'main trunk',
						// source: { url: result.deps.dep1.url },
						// test: {
							// version: '1.1.0-snapshot.0'
						// }
					// }
				// ],
			// );
			// assert.equal(bowerJsonOk, true, 'Correct bower.json has been set on tag');
		// });


		// helpers.promiseIt('single project tag, with selected dependencies', async (tempDir) => {
			// const result = await helpers.createRepoCheckout(
				// tempDir,
				// transport,
				// {
					// name: 'main',
					// version: '0.1.0-snapshot.0',
					// modules: [
						// {
							// name: 'dep1',
							// version: '1.0.0-snapshot.0'
						// },
						// {
							// name: 'dep2',
							// version: '1.0.0-snapshot.0'
						// }
					// ]
				// },
			// );
			// await bowerex.commands.tag(['dep1'], {
				// "cwd": result.checkoutDir,
				// 'config.interactive': false
			// });
			// let exists = await transport.exists(result.url, { type: 'tag', name: '0.1.0' }, 'bower.json');
			// assert.equal(exists, false, 'Tag has not been created for main project');
			// exists = await transport.exists(result.deps.dep1.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');
			// exists = await transport.exists(result.deps.dep2.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, false, 'Tag has been not created for single dependency');
		// });


		// helpers.promiseIt('single project tag, with selected dependencies with dependencies', async (tempDir) => {
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
							// modules: [
								// {
									// name: 'dep3',
									// version: '1.0.0-snapshot.0'
								// }
							// ]
						// },
						// {
							// name: 'dep2',
							// version: '1.0.0-snapshot.0'
						// }
					// ]
				// },
			// );
			// await bowerex.commands.tag(['dep1'], {
				// "cwd": result.checkoutDir,
				// 'config.interactive': false
			// });
			// let exists = await transport.exists(result.url, { type: 'tag', name: '0.1.0' }, 'bower.json');
			// assert.equal(exists, false, 'Tag has not been created for main project');
			// exists = await transport.exists(result.deps.dep1.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');
			// exists = await transport.exists(result.deps.dep2.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, false, 'Tag has been not created for single dependency');
			// exists = await transport.exists(result.deps.dep3.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');
		// });


		// helpers.promiseIt('single project tag, with 2nd and 3rd-level dependencies', async (tempDir) => {
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
							// modules: [
								// {
									// name: 'dep2',
									// version: '2.0.0-snapshot.0',
									// modules: [
										// {
											// name: 'dep3',
											// version: '3.0.0-snapshot.0'
										// }
									// ]
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
			// let exists = await transport.exists(result.url, { type: 'tag', name: '0.1.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for main project');
			// exists = await transport.exists(result.deps.dep1.url, { type: 'tag', name: '1.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');
			// exists = await transport.exists(result.deps.dep2.url, { type: 'tag', name: '2.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');
			// exists = await transport.exists(result.deps.dep3.url, { type: 'tag', name: '3.0.0' }, 'bower.json');
			// assert.equal(exists, true, 'Tag has been created for single dependency');

			// // verify bower.json contents
			// const bowerJsonOk = await helpers.verifyBowerJson(
				// transport,
				// [
					// { // check tagged project json
						// name: 'main',
						// source: { url: result.url, targetDesc: { type: 'tag', name: '0.1.0' } },
						// test: {
							// version: '0.1.0',
							// deps: [
								// {
									// name: 'dep1',
									// url: transport.formatBowerDependencyUrl(result.deps.dep1.url, { type: 'tag', name: '1.0.0' })
								// }
							// ]
						// }
					// },
					// { // check dependency json
						// name: 'dep1',
						// source: { url: result.deps.dep1.url, targetDesc: { type: 'tag', name: '1.0.0' } },
						// test: {
							// version: '1.0.0',
							// deps: [
								// {
									// name: 'dep2',
									// url: transport.formatBowerDependencyUrl(result.deps.dep2.url, { type: 'tag', name: '2.0.0' })
								// }
							// ]
						// }
					// },
					// { // check dependency json
						// name: 'dep2',
						// source: { url: result.deps.dep2.url, targetDesc: { type: 'tag', name: '2.0.0' } },
						// test: {
							// version: '2.0.0',
							// deps: [
								// {
									// name: 'dep3',
									// url: transport.formatBowerDependencyUrl(result.deps.dep3.url, { type: 'tag', name: '3.0.0' })
								// }
							// ]
						// }
					// },
					// { // check dependency json
						// name: 'dep3',
						// source: { url: result.deps.dep3.url, targetDesc: { type: 'tag', name: '3.0.0' } },
						// test: {
							// version: '3.0.0'
						// }
					// }
				// ],
			// );
			// assert.equal(bowerJsonOk, true, 'Correct bower.json has been set on tag');
		// });
	});
}

defineTests(svnTransport);
if (os.platform() !== 'win32') {
	defineTests(gitTransport);
}

