import fs from 'fs-extra';
import path from 'path';
import uuid from 'uuid';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import clone from '../lib/clone.js';
import exportProject from '../lib/exportProject.js';

describe(`export tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.testOnly('export basic', async (tempDir) => {
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
		
		const exportDir = path.join( tempDir, uuid.v4() );
		await exportProject( exportDir, { cwd: checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( exportDir, '.git' ) ), '.git folder included in export' );
		chai.assert.ok( fs.existsSync( path.join( exportDir, 'file.txt' ) ), 'file.txt included in export' );
		chai.assert.ok( fs.existsSync( path.join( exportDir, 'flavio_modules', 'main2', '.git' ) ), '.git folder included in export for dependency' );
		chai.assert.ok( fs.existsSync( path.join( exportDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'file2.txt included in export for dependency' );
	});
});
