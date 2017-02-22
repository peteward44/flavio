// Intended to be able to quickly create test repo's from the command line for manual testing
require('babel-register');

const fs = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const helpers = require('./helpers.js');
const gsi = require('git-svn-interface');


function start() {
	const argv = yargs.argv;

	const defaultTempDir = argv.cwd || path.join(process.cwd(), 'repo');
	fs.ensureDirSync(defaultTempDir);

	let config;
	if (argv.basic) {
		config = {
			name: 'main',
			version: '0.1.0-snapshot.0',
			nobowerjson: argv.nobowerjson,
			checkoutMainOnly: true
		};
	} else {
		config = {
			name: 'main',
			version: '0.1.0-snapshot.0',
			modules: [
				{
					name: 'dep1',
			//		branch: 'branch1',
					version: '1.0.0-snapshot.0',
					files: [
						{
							path: 'file.txt',
							contents: 'contents'
						}
					]
				}
			],
			nobowerjson: argv.nobowerjson
		};
	}

	const prom = helpers.createRepoCheckout(
		defaultTempDir,
		gsi.svn,
		config,
	);
	prom.then((report) => {
		console.log(`URL: ${report.url}`);
		console.log(`Checked out dir: ${report.checkoutDir}`);
	});
	prom.catch((err) => {
		console.error(err);
	});
}


start();
