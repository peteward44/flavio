// import fs from 'fs';
// import path from 'path';
// import semver from 'semver';
// import winston from 'winston';
// import * as misc from './misc.js';
// import * as getTransport from './getTransport.js';
// import * as localChanges from './tag_localChanges.js';
// import findRecyclableTag from './tag_recycle.js';


// async function findNextAvailableVersion(options, pkg, pkgWd, tagsArray, doPatchBump) {
	// let bumpVersion = options.bumpVersion;
	// if (doPatchBump && options.bumpVersionLocalChanges) {
		// // use patch bump if we have local changes off a checked out a 'recyclable' revision number and have local changes ready to commit
		// bumpVersion = options.bumpVersionLocalChanges;
	// }
	// const version = semver.inc(pkg.version, bumpVersion);
	// // check version tag does not already exist
	// if (tagsArray.includes(version)) {
		// let nextAvailableVersion = version;
		// do {
			// nextAvailableVersion = semver.inc(nextAvailableVersion, bumpVersion);
		// } while (tagsArray.includes(nextAvailableVersion));
		// // allow user to choose from next available major/minor/bugfix version, specify their own version number or abort operation
		// const response = await misc.prompt(options,
			// {
				// type: 'list',
				// message: `Tag version ${version} for package ${pkg.name} already exists!\nSelect an option:`,
				// choices: [
					// { value: 0, name: `Use next available version ${nextAvailableVersion}` },
					// { value: 1, name: 'Specify a version name' },
					// { value: 2, name: 'Abort operation' }
				// ],
				// default: 0
			// },
		// );
		// if (response === 0) {
			// return nextAvailableVersion;
		// } else if (response === 1) {
			// let answer;
			// let first = true;
			// do {
				// if (!first) {
					// winston.info(`${answer} already exists!`);
				// }
				// first = false;
				// answer = await misc.prompt(options,
					// {
						// type: 'input',
						// message: 'Specify a tag name'
					// },
				// );
			// } while (tagsArray.includes(answer));
			// return answer;
		// } else {
			// // if no, abort operation
			// throw new Error(`Tag version ${version} for package ${pkg.name} already exists!`);
		// }
	// }
	// return version;
// }


// async function listTags(transport, url) {
	// const tagsArray = await transport.listTags(url);
	// const result = [];
	// for (let i = 0; i < tagsArray.length; ++i) {
		// const ver = tagsArray[i];
		// if (semver.valid(ver)) {
			// result.push(ver);
		// }
	// }
	// return result;
// }

/**
 * Analyses all packages and decides if they need a tag created, and what version number they should be tagged at if so
 *
 * @param {Array.<string>} names - Names of packages to tag, or empty for all
 * @param {Object} options - Command line options 
 */
export default async function decideVersions(names, options) {
	const defaultVersion = '1.0.0';
	const bowerJsonPath = path.join(options.cwd, 'bower.json');
	let bowerJson;
	const versionReport = {};
	if (fs.existsSync(bowerJsonPath)) {
		bowerJson = JSON.parse(fs.readFileSync(bowerJsonPath));
	}
	for (let i = 0; i < packageArray.length; ++i) {
		const pkg = packageArray[i];
		if (pkg.missing) {
			continue;
		}
		const pkgWd = misc.addPackageToWorkDescriptor(workDescriptor, pkg);
		let doFix = true;
		// no tag required if it's already tagged with no local changes
		if (!pkg.external && (misc.isLinked(bowerJson, pkg.name) || pkg.isMain)) {
			const transport = getTransport.fromType(pkg.transportType);
			const tagsArray = await listTags(transport, pkg.url);

			// if we have a recyclable tag, make sure there are no local changes on the package or any of it's dependencies otherwise
			// we need a new tag
			const doPatchBump = await localChanges.checkPatchBumpRequired(packageArray, pkg, pkgWd, workDescriptor);

			// no need to tag this - no local changes (or dependencies with local changes) and it's already a tag
			const alreadyTagged = !doPatchBump && pkg.targetDesc.type === 'tag';
			if (!alreadyTagged) {
				const recycleVersion = await findRecyclableTag(transport, tagsArray, pkg.dir, pkg.url, pkg.targetDesc, packageArray, workDescriptor);
				// dont recycle if we either can't find a valid recyclable version, or there are local changes to commit
				if (!recycleVersion || doPatchBump) {
					let ver;
					if (i === 0 && options.tagName) {
						// overwrite root project name if specified
						ver = options.tagName;
					} else {
						ver = await findNextAvailableVersion(options, pkg, pkgWd, tagsArray, doPatchBump);
					}
					if (!ver) {
						ver = defaultVersion;
					}
					pkgWd.doTag = true;
					pkgWd.versionFix = ver;
					if (options.bumpMasterVersion) {
						let prerelease;
						if (typeof options.bumpMasterPreRelease === 'string' && options.bumpMasterPreRelease.length > 0) {
							prerelease = options.bumpMasterPreRelease;
						}
						pkgWd.postVersion = semver.inc(ver, options.bumpMasterVersion, prerelease);
					}
					winston.info(`Creating fresh tag ${ver} for ${pkg.name}`);
				} else {
					pkgWd.versionFix = recycleVersion;
					winston.info(`Recycling tag ${recycleVersion} for ${pkg.name}`);
				}
				doFix = false;
			}
		}

		if (doFix) {
			// package already tagged - it may have been defined using a semver range or 'latest' target name in bower.json
			// though so fix it to the version being used
			pkgWd.versionFix = pkg.version || defaultVersion;
			winston.info(`Fixing to ${pkg.version} for ${pkg.name}`);
		}

		pkgWd.versionFix = pkgWd.versionFix || defaultVersion;
		if (pkg.isMain) {
			versionReport._ = pkgWd.versionFix;
		} else {
			versionReport[pkg.name] = pkgWd.versionFix;
		}
	}
	return versionReport;
}

