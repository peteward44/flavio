import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';

/**
 * @typedef PackageDescriptor
 * @property {string} name - Name of package as defined in caliber.json
 * @property {string} version - Current version
 * @property {string} path - Directory path
 * @property {string} repo - Repository path in 'bower' format
 * @property {string} scm - Source control type, either 'git' or 'svn'
 */

/**
 * Gets a list of the available packages currently installed
 *
 * @param {Object} options - Command line options
 * @returns {Promise.<Array.<PackageDescriptor>>}
 */
async function buildPackageList( options ) {
	let result = [];
	await processCaliberJson( path.join( options.cwd, 'caliber.json' ) );
	return result;
}

export default buildPackageList;
