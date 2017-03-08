// import path from 'path';
// import fs from 'fs-extra';
// import * as misc from './misc.js';
// import * as bowerTools from './bowerTools.js';
// import * as getTransport from './getTransport.js';


// export async function checkLocalChanges(options, packageArray, workDescriptor) {
	// const unclean = [];
	// let uncleanNames = '';
	// const dirtyBowerJsonList = [];
	// let dirtyBowerJsonListNames = '';

	// for (let i = 0; i < packageArray.length; ++i) {
		// const pkg = packageArray[i];
		// if (pkg.linked && !pkg.external && !pkg.missing) {
			// const transport = await getTransport.fromType(pkg.transportType);
			// const clean = await transport.isWorkingCopyClean(pkg.dir);
			// // console.log( "Working copy " + pkg.dir + " clean=" + clean.toString() );
			// if (!clean) {
				// unclean.push(pkg);
				// uncleanNames += `\t-> ${pkg.name}\n`;

				// const isBowerJsonDirty = await transport.isWorkingCopyClean(pkg.dir, 'bower.json');
				// if (!isBowerJsonDirty) {
					// dirtyBowerJsonList.push(pkg);
					// dirtyBowerJsonListNames += `\t-> ${pkg.name}\n`;
				// }
			// }
		// }
	// }

	// // prompt user on whether they want to commit the local changes into the tag
	// // list files which will be committed to confirm
	// if (unclean.length > 0) {
		// const answer = await misc.prompt(options, {
			// type: 'confirm',
			// message: `The following packages have uncommited working copy changes:\n${uncleanNames}Commit as part of tag?`,
			// default: options.commitLocalChanges || options.mergeLocalChanges
		// });
		// if (answer) {
			// // only offer to merge if we are currently on a tag
			// const mergeAnswer = await misc.prompt(options, {
				// type: 'confirm',
				// message: 'Do you wish to merge the local changes into the original branch?',
				// default: options.mergeLocalChanges
			// });
			// let mergeBowerJsonAnswer = false;
			// if (mergeAnswer && dirtyBowerJsonList.length > 0) {
				// mergeBowerJsonAnswer = await await misc.prompt(options, {
					// type: 'confirm',
					// message: `The following packages have local changes in bower.json:\n${dirtyBowerJsonListNames}Include bower.json in merge?`,
					// default: false
				// });
			// }
			// unclean.forEach((pkg) => {
				// misc.addPackageToWorkDescriptor(workDescriptor, pkg).commitLocalChanges = true;
				// misc.addPackageToWorkDescriptor(workDescriptor, pkg).mergeLocalChanges = mergeAnswer;
				// misc.addPackageToWorkDescriptor(workDescriptor, pkg).mergeBowerJson = mergeBowerJsonAnswer;
			// });
		// }
	// }
// }


// export async function checkPatchBumpRequired(packageArray, pkg, pkgWd, workDescriptor) {
	// async function checkTagDeps(deps) {
		// for (const dep in deps) {
			// if (deps.hasOwnProperty(dep)) {
				// const pkg2 = bowerTools.existsInPackageArray(packageArray, dep);
				// if (pkg2) {
					// const pkgWd2 = misc.addPackageToWorkDescriptor(workDescriptor, pkg2);
					// if (await checkPatchBumpRequired(packageArray, pkg2, pkgWd2, workDescriptor)) {
						// return true;
					// }
				// }
			// }
		// }
		// return false;
	// }

	// if (pkg.missing) {
		// return false;
	// }

	// if (pkgWd.commitLocalChanges) {
		// // local changes - do patch bump
		// return true;
	// }

	// const bowerJsonPath = path.join(pkg.dir, 'bower.json');
	// if (fs.existsSync(bowerJsonPath)) {
		// const json = JSON.parse(fs.readFileSync(bowerJsonPath));
		// // if ( !( json.ex && json.ex.tagTarget ) ) {
			// // // not a tagged version - not eligible for patch version bump
			// // return false;
		// // }
		// // check package dependencies to see if they have been patch bumped
		// // if so, we should patch bump this too
		// if (json) {
			// if (await checkTagDeps(json.dependencies)) {
				// return true;
			// }
			// if (await checkTagDeps(json.devDependencies)) {
				// return true;
			// }
		// }
	// }
	// return false;
// }

