import fs from 'fs-extra';
import path from 'path';
import uuid from 'uuid';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import TestRepo from '../testutil/TestRepo.js';
import update from '../lib/update.js';
import exportProject from '../lib/exportProject.js';

describe(`export tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes

	helpers.test('export basic', async (tempDir) => {
		const result = await TestRepo.create( tempDir, 'one' );
		await update( { cwd: result.project.checkoutDir } );
		const exportDir = path.join( tempDir, uuid.v4() );
		await exportProject( exportDir, { cwd: result.project.checkoutDir } );
		chai.assert.ok( fs.existsSync( path.join( exportDir, '.git' ) ), '.git folder included in export' );
		chai.assert.ok( fs.existsSync( path.join( exportDir, 'file.txt' ) ), 'file.txt included in export' );
		chai.assert.ok( fs.existsSync( path.join( exportDir, 'flavio_modules', 'dep1', '.git' ) ), '.git folder included in export for dependency' );
		chai.assert.ok( fs.existsSync( path.join( exportDir, 'flavio_modules', 'dep1', 'file.txt' ) ), 'file2.txt included in export for dependency' );
	});
});
