// import path from 'path';
// import fs from 'fs-extra';
// import _ from 'underscore';
// import winston from 'winston';
// import * as misc from './misc.js';
// import * as bowerTools from './bowerTools.js';
// import * as getTransport from './getTransport.js';
// import * as localChanges from './tag_localChanges.js';
// import decideVersions from './tag_decideVersions.js';


// async function stampBowerJson(options, rootPkg, bowerJson, packageArray, workDescriptor) {
	// function replaceTrunksWithVersions(depsObj) {
		// if (!depsObj) {
			// return;
		// }
		// // put new versions of all dependency modules into project's bower.json
		// for (const moduleName in depsObj) {
			// if (depsObj.hasOwnProperty(moduleName)) {
				// const pkg = bowerTools.existsInPackageArray(packageArray, moduleName);
				// if (pkg) {
					// const pkgWd = misc.addPackageToWorkDescriptor(workDescriptor, pkg);
					// if (pkgWd.versionFix) {
						// if (pkg.external) {
							// if (options.fixExternal) {
								// depsObj[moduleName] = pkgWd.versionFix;
							// }
						// } else {
							// // module exists in 'version fix' array, replace value with fixed version
							// const transport = getTransport.fromType(pkg.transportType);
							// // console.log( JSON.stringify( pkg,null,2 ) );
							// depsObj[moduleName] = transport.formatBowerDependencyUrl(pkg.url, { type: 'tag', name: pkgWd.versionFix });
						// }
					// }
				// }
			// }
		// }
	// }
	// // replace version in bower.json with incremented one
	// const rootPkgWd = misc.addPackageToWorkDescriptor(workDescriptor, rootPkg);
	// if (rootPkgWd.versionFix) {
		// bowerJson.version = rootPkgWd.versionFix;
	// }
	// replaceTrunksWithVersions(bowerJson.dependencies);
	// replaceTrunksWithVersions(bowerJson.devDependencies);

	// // remove any custom resolutions for packages that we have tagged
	// if (bowerJson.resolutions) {
		// for (const moduleName in bowerJson.resolutions) {
			// if (bowerJson.resolutions.hasOwnProperty(moduleName)) {
				// const pkg = bowerTools.existsInPackageArray(packageArray, moduleName);
				// const pkgWd = misc.addPackageToWorkDescriptor(workDescriptor, pkg);
				// if (pkg && pkgWd.versionFix) {
					// delete bowerJson.resolutions[moduleName];
				// }
			// }
		// }
	// }
	// return bowerJson;
// }


// async function bumpTrunkBowerJson(rootPkg, bowerJson, workDescriptor) {
	// const rootPkgWd = misc.addPackageToWorkDescriptor(workDescriptor, rootPkg);
	// if (rootPkgWd.postVersion && rootPkgWd.postVersion !== bowerJson.version) {
		// bowerJson.version = rootPkgWd.postVersion;
		// return bowerJson;
	// }
	// // version the same - don't update trunk bower.json
	// return null;
// }


// async function createBowerJsons(options, packageArray, workDescriptor) {
	// // change local copies of all the bower.json's in all packages involved, ready to commit
	// for (const pkgName in workDescriptor) {
		// if (workDescriptor.hasOwnProperty(pkgName)) {
			// const pkgWd = workDescriptor[pkgName];
			// if (pkgWd.doTag) {
				// const pkg = pkgWd.pkg;

				// // stamp the existing bower.json
				// const bowerJsonPath = path.join(pkg.dir, 'bower.json');
				// if (fs.existsSync(bowerJsonPath)) {
					// const bowerJsonString = fs.readFileSync(bowerJsonPath);
					// pkgWd.taggedBowerJson = await stampBowerJson(options, pkg, JSON.parse(bowerJsonString), packageArray, workDescriptor);
				// }

				// // read in bower.json from trunk and bump the version
				// const transport = getTransport.fromType(pkg.transportType);
				// if (await transport.exists(pkg.url, null, 'bower.json')) {
					// const trunkBowerJsonString = await transport.cat(pkg.url, null, 'bower.json');
					// const trunkBowerJson = JSON.parse(trunkBowerJsonString);
					// pkgWd.trunkBowerJson = await bumpTrunkBowerJson(pkg, trunkBowerJson, workDescriptor);
				// }
			// }
		// }
	// }
// }


// async function getUserConfirmation(options, workDescriptor) {
	// let tagsList = '';
	// for (const pkgName in workDescriptor) {
		// if (workDescriptor.hasOwnProperty(pkgName)) {
			// const pkgWd = workDescriptor[pkgName];
			// const pkg = pkgWd.pkg;
			// if (pkgWd.doTag) {
				// tagsList += `\t-> ${pkg.name} : ${pkgWd.versionFix}\n`;
			// }
		// }
	// }
	// const answer = await misc.prompt(options, {
		// type: 'confirm',
		// message: `Confirm the creation of the following tags:\n${tagsList}`,
		// default: true
	// });
	// return answer;
// }


// async function createTags(packageArray, workDescriptor) {
	// for (const pkgName in workDescriptor) {
		// if (workDescriptor.hasOwnProperty(pkgName)) {
			// const pkgWd = workDescriptor[pkgName];
			// if (pkgWd.doTag) {
				// const pkg = pkgWd.pkg;
				// const transport = getTransport.fromType(pkg.transportType);

				// let commentPrefix;
				// if (pkgWd.taggedBowerJson) {
					// commentPrefix = `Tag ${pkgWd.taggedBowerJson.name} [${pkgWd.taggedBowerJson.version.toString()}] `;
				// } else {
					// commentPrefix = 'Tag: ';
				// }

				// // console.log( "Creating tag for pkg " + JSON.stringify( pkg, null, 2 ) );
				// // get the head revision of the url before we add the trunk's bower.json
				// const urlHeadRevision = await transport.getUrlHeadRevision(pkg.url, pkg.targetDesc);
				// // commit an updated bower.json to the _trunk_ of the project (regardless of if we are tagging from a branch)
				// // get the revision that was generated by that commit
				// const workingCopyRevision = await transport.getWorkingCopyRevision(pkg.dir);
				// let committedRevision;
				// if (pkgWd.trunkBowerJson) {
					// committedRevision = await transport.unCat(
						// pkg.url,
						// null,
						// 'bower.json',
						// {
							// contents: JSON.stringify(pkgWd.trunkBowerJson, null, 2),
							// msg: `${commentPrefix}Updating master bower.json to use version ${pkgWd.trunkBowerJson.version.toString()}`
						// },
					// );
				// }
				// let taggedBowerJson;
				// if (pkgWd.taggedBowerJson) {
					// taggedBowerJson = pkgWd.taggedBowerJson;
					// // add a list of revisions that working copies can share if they can recycle this tag.
					// taggedBowerJson.ex = taggedBowerJson.ex || {};
					// taggedBowerJson.ex.recyclableRevisions = [workingCopyRevision];
					// // add just-committed revision if we are tagging the head, this is so we can
					// if (committedRevision !== undefined && urlHeadRevision === workingCopyRevision) {
						// taggedBowerJson.ex.recyclableRevisions.push(committedRevision);
					// }
					// if (taggedBowerJson.ex.tagTarget && !taggedBowerJson.ex.originalTagTarget) {
						// taggedBowerJson.ex.originalTagTarget = taggedBowerJson.ex.tagTarget;
					// }
					// taggedBowerJson.ex.tagTarget = pkg.targetDesc;
					// taggedBowerJson.ex.tagLocalChanges = Boolean(pkgWd.commitLocalChanges); // allow local changes inside tag
				// }
				// let mergeOriginalBranchTargetDesc;
				// if (pkgWd.mergeLocalChanges) {
					// // TODO: cache json read in, in checked out package dir
					// const bowerJsonPath = path.join(pkg.dir, 'bower.json');
					// if (fs.existsSync(bowerJsonPath)) {
						// const json = JSON.parse(fs.readFileSync(bowerJsonPath));
						// // if the original tag target was a tag, use the original tag target to commit to
						// if (json.ex) {
							// mergeOriginalBranchTargetDesc = json.ex.originalTagTarget || json.ex.tagTarget;
						// } else {
							// mergeOriginalBranchTargetDesc = pkg.targetDesc;
						// }
					// }
				// }
		// //		console.log( "Creating tag for " + JSON.stringify( pkg, null, 2 ) );
				// const tagOptions = {
					// commit: pkgWd.commitLocalChanges,
					// revision: workingCopyRevision,
					// commentPrefix
				// };
				// if (taggedBowerJson) {
					// tagOptions.files = [{ contents: JSON.stringify(taggedBowerJson, null, 2), path: 'bower.json' }];
				// }
				// if (pkgWd.mergeLocalChanges) {
					// tagOptions.merge = {
						// exclude: (pkgWd.mergeBowerJson ? null : 'bower.json'),
						// targetDesc: mergeOriginalBranchTargetDesc
					// };
				// }
				// await transport.createTag(
					// pkg.dir,
					// pkg.url,
					// pkg.targetDesc,
					// pkgWd.versionFix,
					// tagOptions,
				// );
			// }
		// }
	// }
// }

/**
 * Executes tag command on project
 *
 * @param {Array.<string>} names - Names of packages to tag, or empty for all
 * @param {Object} options - Command line options
 */
export default async function tagProject(names = [], options = {}) {
	// for each package we are going to tag, scan the packages and see what name we should give the new tag for each package
	const versionReport = await decideVersions(options, packageArray, workDescriptor);
	let finishMessage;
	if (countPackagesRequiringTags(workDescriptor) > 0) {
		// then create the bower.json's we should store in each package's tag, as well as an updated one on the trunk of each package
		await createBowerJsons(options, packageArray, workDescriptor);
		if (await getUserConfirmation(options, workDescriptor)) {
			// create the tags for each package
			await createTags(packageArray, workDescriptor);
			finishMessage = 'All tags created.';
		} else {
			winston.info('Operation cancelled');
		}
	} else {
		// work out latest version of main project if no tag required, so user can use that instead
		finishMessage = 'No packages require tagging.';
	}
	if (finishMessage) {
		const transport = getTransport.fromWorkingCopy(options.cwd);
		const info = await transport.getWorkingCopyInfo(options.cwd);
		const bowerUrl = transport.formatBowerDependencyUrl(info.url, { type: 'tag', name: versionReport._ });
		winston.info(`${finishMessage} ${bowerUrl}`);
	}
}
