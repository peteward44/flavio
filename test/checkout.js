import chai from 'chai';
import path from 'path';
import * as helpers from '../testutil/helpers.js';
import checkout from '../src/checkout.js';
import update from '../src/update.js';
import GitRepositorySnapshot from '../src/GitRepositorySnapshot.js';

describe(`checkout tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes
	
	helpers.test('1 dependency', async (tempDir) => {
		const result = await helpers.addProject( tempDir, {
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
		
		const main2Dir = path.join( result.checkoutDir, 'flavio_modules', 'main2' );
		let main2Snapshot = await GitRepositorySnapshot.fromDir( main2Dir );
		chai.assert.equal( ( await main2Snapshot.getTarget() ).branch, 'my_branch', 'dependency on my_branch' );
		await checkout( 'master', { 'cwd': result.checkoutDir } );
		main2Snapshot = await GitRepositorySnapshot.fromDir( main2Dir );
		chai.assert.equal( ( await main2Snapshot.getTarget() ).branch, 'master', 'dependency on master' );
		await checkout( 'my_branch_doesnt_exist', { 'cwd': result.checkoutDir } );
		main2Snapshot = await GitRepositorySnapshot.fromDir( main2Dir );
		chai.assert.equal( ( await main2Snapshot.getTarget() ).branch, 'master', 'dependency on my_branch' );
		await checkout( 'my_branch', { 'cwd': result.checkoutDir } );
		main2Snapshot = await GitRepositorySnapshot.fromDir( main2Dir );
		chai.assert.equal( ( await main2Snapshot.getTarget() ).branch, 'my_branch', 'dependency on my_branch' );
		await checkout( 'my_branch_doesnt_exist', { 'cwd': result.checkoutDir } );
		main2Snapshot = await GitRepositorySnapshot.fromDir( main2Dir );
		chai.assert.equal( ( await main2Snapshot.getTarget() ).branch, 'my_branch', 'dependency on my_branch' );
	});
});
