import path from 'path';
import fs from 'fs-extra';
import * as git from './git.js';
import * as resolve from './resolve.js';
import * as util from './util.js';
import handleConflict from './handleConflict.js';


function findNewRepoDir( pkgdir ) {
	let index = 0;
	let newdir;
	do {
		newdir = `${pkgdir}_${index}`;
		index++;
	} while ( fs.existsSync( newdir ) );
	return newdir;
}


async function changeRepo( pkgdir, repo ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	const repoState = await util.hasRepoChanged( repo, pkgdir );
	if ( repoState === 'url' ) {
		// completely different repo - rename old directory to preverse data
		const newPkgDir = findNewRepoDir( pkgdir );
		fs.renameSync( pkgdir, newPkgDir );
		// then clone new one
		await git.clone( repoUrl.url, pkgdir, { master: true } );
		const targetObj = await resolve.getTargetFromRepoUrl( repo, pkgdir );
		await git.checkout( pkgdir, targetObj );
	} else if ( repoState === 'target' ) {
		const targetObj = await resolve.getTargetFromRepoUrl( repo, pkgdir );
		await git.checkout( pkgdir, targetObj );
	}
}

/**
 * When a repo is cloned, it is named a random UUID instead of the final folder name, so it can be checked for conflicts before commiting.
 * This class manages that
 *
 */
class RepoCloneCache {
	constructor( options ) {
		this._options = options;

		this._rootFlavioJson = null;
		this._lockedDirs = new Set(); // packages directories that can not be switched
	}
	
	async init( rootFlavioJson ) {
		this._rootFlavioJson = rootFlavioJson;
	}
	
	async add( name, module, options = {} ) {
		const repoUrl = util.parseRepositoryUrl( module.repo );
		const rootPath = await util.getPackageRootPath( this._options.cwd );
		const pkgdir = module.dir;
		if ( !fs.existsSync( pkgdir ) ) {
			// fresh checkout
			await git.clone( repoUrl.url, pkgdir, { master: true } );
			const targetObj = await resolve.getTargetFromRepoUrl( module.repo, pkgdir );
			await git.checkout( pkgdir, targetObj );
		} else {
			const repoState = await util.hasRepoChanged( module.repo, pkgdir );
			if ( repoState === 'url' ) {
				// dir has already been used by different repo - conflict
				const repo = await handleConflict( this._options, name, module, this._rootFlavioJson );
				await changeRepo( pkgdir, repo );
			} else if ( repoState === 'target' ) {
				if ( !this._lockedDirs.has( module.dir ) ) {
					// already existing version has not been used already, use that cloned repo to do a switch
					const targetObj = await resolve.getTargetFromRepoUrl( module.repo, pkgdir );
					const stashName = await git.stash( pkgdir );
					await git.pull( pkgdir );
					if ( !options.pullOnly ) {
						await git.checkout( pkgdir, targetObj );
					}
					await git.stashPop( pkgdir, stashName );				
				} else {
					// dir has already been used by a different branch - conflict
					const repo = await handleConflict( this._options, name, module, this._rootFlavioJson );
					await changeRepo( pkgdir, repo );
				}
			} else {
				// repo is the same - do an update
				const stashName = await git.stash( pkgdir );
				await git.pull( pkgdir );
				await git.stashPop( pkgdir, stashName );				
			}
		}
		if ( !this._lockedDirs.has( module.dir ) ) {
			this._lockedDirs.add( module.dir );
		}
		return pkgdir;
	}
}


export default RepoCloneCache;
