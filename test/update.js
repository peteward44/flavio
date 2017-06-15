import fs from 'fs-extra';
import path from 'path';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import update from '../lib/update.js';
import install from '../lib/install.js';

describe(`update tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('update no dependencies', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0'
		} );
		await install( [], { cwd: result.checkoutDir } );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ) );
		await git.addRemoteFile( 'file.txt', 'file contents', result.repoDir, { branch: 'master' } );
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ) );
	});

	helpers.test('update 1 dependency', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			modules: [
				{
					name: 'main2',
					version: '0.2.0-snapshot.0'
				}
			]
		} );
		
		await install( [], { cwd: result.checkoutDir } );
		
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ) );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file.txt' ) ) );

		await git.addRemoteFile( 'file.txt', 'file contents', result.repoDir, { branch: 'master' } );
		await git.addRemoteFile( 'file.txt', 'file contents', result.deps.main2.repoDir, { branch: 'master' } );
		
		await update( { cwd: result.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ) );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file.txt' ) ) );
	});

	helpers.test('update many dependencies', async (tempDir) => {
		const result = await git.addProject( tempDir, {
			name: 'main',
			version: '0.1.0-snapshot.0',
			modules: [
				{
					name: 'main2',
					version: '0.2.0-snapshot.0',
					modules: [
						{
							name: 'main3',
							version: '0.3.0-snapshot.0'
						}
					]
				},
				{
					name: 'main4',
					version: '0.4.0-snapshot.0',
					modules: [
						{
							name: 'main5',
							version: '0.5.0-snapshot.0',
							modules: [
								{
									name: 'main6',
									version: '0.6.0-snapshot.0'
								}
							]
						}
					]
				}
			]
		} );
		
		await install( [], { cwd: result.checkoutDir } );
		
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ) );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file.txt' ) ) );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file.txt' ) ) );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main4', 'file.txt' ) ) );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main5', 'file.txt' ) ) );
		chai.assert.ok( !fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main6', 'file.txt' ) ) );

		await git.addRemoteFile( 'file.txt', 'file contents', result.repoDir, { branch: 'master' } );
		await git.addRemoteFile( 'file.txt', 'file contents', result.alldeps.main2.repoDir, { branch: 'master' } );
		await git.addRemoteFile( 'file.txt', 'file contents', result.alldeps.main3.repoDir, { branch: 'master' } );
		await git.addRemoteFile( 'file.txt', 'file contents', result.alldeps.main4.repoDir, { branch: 'master' } );
		await git.addRemoteFile( 'file.txt', 'file contents', result.alldeps.main5.repoDir, { branch: 'master' } );
		await git.addRemoteFile( 'file.txt', 'file contents', result.alldeps.main6.repoDir, { branch: 'master' } );
		
		await update( { cwd: result.checkoutDir } );
		
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'file.txt' ) ) );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file.txt' ) ) );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main3', 'file.txt' ) ) );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main4', 'file.txt' ) ) );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main5', 'file.txt' ) ) );
		chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main6', 'file.txt' ) ) );
	});
	
	// helpers.test('update 1 dependency', async (tempDir) => {
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
		// await update( { cwd: result.checkoutDir } );
		// chai.assert.ok( fs.existsSync( path.join( result.checkoutDir, 'flavio_modules', 'main2', 'file2.txt' ) ), 'main2 dependency installed' );
	// });
});
