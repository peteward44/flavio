import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import chai from 'chai';
import { svn as svnTransport, git as gitTransport } from 'git-svn-interface';
import * as helpers from '../testutil/helpers.js';
import buildPackageList from '../lib/buildPackageList.js';

function defineTests(transport) {
	describe(`${transport.name} buildPackageList`, function() {
		this.timeout(30 * 60 * 1000); // 30 minutes

		helpers.test('buildPackageList returns correct package for single checkout', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					modules: []
				},
			);
			const packages = await buildPackageList( {
				cwd: result.checkoutDir
			} );
			chai.assert.ok( packages.length === 1 );
			chai.expect( packages[0] ).to.have.property( 'name', 'main' );
			chai.expect( packages[0] ).to.have.property( 'version', '0.1.0-snapshot.0' );
			chai.expect( packages[0] ).to.have.property( 'path', result.checkoutDir );
			chai.expect( packages[0] ).to.have.property( 'scm', transport.name );
			chai.expect( packages[0].targetDesc ).to.deep.equal( { type: 'trunk', name: 'trunk' } );
		});
		
		helpers.test('buildPackageList returns correct package for multiple dependencies', async (tempDir) => {
			const result = await helpers.createRepoCheckout(
				tempDir,
				transport,
				{
					name: 'main',
					version: '0.1.0-snapshot.0',
					modules: [
						{
							name: 'dep1',
							version: '1.0.0-snapshot.0'
						}
					]
				},
			);
			const packages = await buildPackageList( {
				cwd: result.checkoutDir
			} );
			chai.assert.ok( packages.length === 2 );
			chai.expect( packages[0] ).to.have.property( 'name', 'main' );
			chai.expect( packages[0] ).to.have.property( 'version', '0.1.0-snapshot.0' );
			chai.expect( packages[0] ).to.have.property( 'path', result.checkoutDir );
			chai.expect( packages[0] ).to.have.property( 'scm', transport.name );
			chai.expect( packages[0].targetDesc ).to.deep.equal( { type: 'trunk', name: 'trunk' } );
			
			console.log( "result", JSON.stringify( result, null, 2 ) );
			chai.expect( packages[1] ).to.have.property( 'name', 'dep1' );
			chai.expect( packages[1] ).to.have.property( 'version', '1.0.0-snapshot.0' );
			chai.expect( packages[1] ).to.have.property( 'path', result.deps.dep1.dir );
			chai.expect( packages[1] ).to.have.property( 'scm', transport.name );
			chai.expect( packages[1].targetDesc ).to.deep.equal( { type: 'trunk', name: 'trunk' } );
		});
	});
}

defineTests(svnTransport);
if (os.platform() !== 'win32') {
	defineTests(gitTransport);
}
