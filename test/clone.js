import fs from 'fs-extra';
import path from 'path';
import uuid from 'uuid';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import clone from '../lib/clone.js';

describe(`clone tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('clone basic', async (tempDir) => {
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
		const checkoutDir = path.join( tempDir, uuid.v4() );
		await clone( result.repoDir, { cwd: checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( checkoutDir, 'file.txt' ) ), 'main project cloned' );
		chai.assert.ok( fs.existsSync( path.join( checkoutDir, 'caliber_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
	});
});
