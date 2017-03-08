// import semver from 'semver';
// import winston from 'winston';
// import * as misc from './misc.js';
// import * as bowerTools from './bowerTools.js';
// import * as getTransport from './getTransport.js';


// async function isTagOk(transportType, url, targetDesc, dir, tagName, packageArray, workDescriptor) {
// //	console.log( "checking " + dir + " transportType=" + transportType );
	// async function checkTagDeps(deps) {
		// for (const dep in deps) {
			// if (deps.hasOwnProperty(dep)) {
				// const parsed = misc.parseBowerUrl(deps[dep]);
				// const pkg = bowerTools.existsInPackageArray(packageArray, dep);
				// if (pkg && !pkg.missing) {
					// if (!await isTagOk(pkg.transportType, pkg.url, pkg.targetDesc, pkg.dir, parsed.target, packageArray, workDescriptor)) {
						// return false;
					// }
				// }
			// }
		// }
		// return true;
	// }

	// const transport = getTransport.fromType(transportType);
	// if (!(await transport.exists(url, { type: 'tag', name: tagName }, 'bower.json'))) {
		// return false;
	// }

	// const bowerJsonText = await transport.cat(url, { type: 'tag', name: tagName }, 'bower.json');
	// const bowerJson = JSON.parse(bowerJsonText);
	// if (!(bowerJson && bowerJson.ex && bowerJson.ex.recyclableRevisions && bowerJson.ex.tagTarget)) {
		// winston.error("Tag is missing 'ex' JSON member - is this a tag?");
		// return false;
	// }
	// // tag contains tag-specific local changes, so therefore cannot be recycled
	// if (bowerJson.ex.tagLocalChanges) {
		// winston.error('Tag contains local changes');
		// return false;
	// }
	// // check the working copy revision is on the recycle list
	// const workingCopyRevision = await transport.getWorkingCopyRevision(dir);
	// if (!bowerJson.ex.recyclableRevisions.includes(workingCopyRevision)) {
		// winston.error(`Working copy revision ${workingCopyRevision} does not match acceptable values ${JSON.stringify(bowerJson.ex.recyclableRevisions)}`);
		// return false;
	// }
	// // check the working copy is on the same branch that was tagged previously
	// if (bowerJson.ex.tagTarget.name !== targetDesc.name || bowerJson.ex.tagTarget.type !== targetDesc.type) {
		// winston.error(`Tag branch ${JSON.stringify(bowerJson.ex.tagTarget)} does not match existing branch ${JSON.stringify(targetDesc)}`);
		// return false;
	// }

	// // we've found a tag we can potentially used. Now we have to check
	// // the dependencies of the tagged package to make sure they haven't changed either.
	// // If they have, we will need a fresh tag
	// if (!await checkTagDeps(bowerJson.dependencies)) {
		// winston.error('Tag fails dependencies check');
		// return false;
	// }
	// if (!await checkTagDeps(bowerJson.devDependencies)) {
		// winston.error('Tag fails dependencies check');
		// return false;
	// }
	// return true;
// }


// export default async function findRecyclableTag(transport, tagsArray, dir, url, targetDesc, packageArray, workDescriptor) {
	// // list though tags and their respective bower.json files
	// // and check if 'workingCopyRevision' matches any in the ex.recyclableRevisions array
	// if (tagsArray.length > 0) {
		// // sort tags by most recent first, as we are most likely looking for a recently made tag so it'll take less time to find
		// tagsArray = tagsArray.slice(0).sort(semver.rcompare);
		// // console.log( "tags array", tagsArray );
		// for (let i = 0; i < tagsArray.length; ++i) {
			// const tagName = tagsArray[i];
			// if (await isTagOk(transport.name, url, targetDesc, dir, tagName, packageArray, workDescriptor)) {
				// return tagName;
			// }
		// }
	// }
	// return null;
// }
