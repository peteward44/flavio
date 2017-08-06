import fs from 'fs-extra';
import path from 'path';
import uuid from 'uuid';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import add from '../lib/add.js';
import update from '../lib/update.js';

describe(`add tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('add basic', async (tempDir) => {
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
							contents: 'this is on the main2 project'
						}
					]
				}
			]
		} );

		// submodule we are going to add
		const result2 = await git.addProject( tempDir, {
			name: 'main3',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file3.txt',
					contents: 'this is on the main project'
				}
			]
		} );
		
		await update( { cwd: result.checkoutDir } );
		
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ), 'main project cloned' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency not installed' );
		
		await add( `main3`, `${result2.repoDir}#master`, { cwd: result.checkoutDir } );
		
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ), 'main project cloned' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file3.txt' ) ), 'main3 dependency installed' );
	});
});
