import fs from 'fs-extra';
import path from 'path';
import chai from 'chai';
import * as helpers from '../testutil/helpers.js';
import * as git from '../lib/git.js';
import * as util from '../lib/util.js';
import update from '../lib/update.js';
import status from '../lib/status.js';

describe(`status tests`, function() {
	this.timeout(30 * 60 * 1000); // 30 minutes
	
	helpers.test('no dependencies', async (tempDir) => {

	});
});
