import fs from 'fs-extra';
import path from 'path';
import uuid from 'uuid';
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
		
		await tag( { cwd: result.checkoutDir } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
	});

	helpers.testOnly('tag one dependency', async (tempDir) => {
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
		
		await update( { cwd: result.checkoutDir } );
		await tag( { cwd: result.checkoutDir } );
		chai.assert.ok( await git.tagExists( result.checkoutDir, "0.1.0" ) );
		chai.assert.ok( await git.tagExists( path.join( result.checkoutDir, 'flavio_modules', 'main2' ), "0.2.0" ) );
	});
});
