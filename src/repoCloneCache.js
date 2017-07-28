import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';
import * as git from './git.js';
import * as resolve from './resolve.js';

/**
 * @returns {string} - Either 'url', 'target' or empty string, depending what has changed on the repo
 */
function hasRepoChanged( repo, dir ) {
	const repoUrl = util.parseRepositoryUrl( repo );
	// make sure it's the same repo URL
	const localUrl = await git.getWorkingCopyUrl( dir, true );
	if ( localUrl !== repoUrl.url ) {
		// Repository URL is different to pre-existing module "name"
		return 'url';
	}
	const targetObj = await resolve.getTargetFromRepoUrl( repo );
	const targetCur = await git.getCurrentTarget( dir );
	const targetChanged = targetObj.branch !== targetCur.branch || targetObj.tag !== targetCur.tag;
	if ( targetChanged ) {
		return 'target';
	}
	return '';
}

/**
 * When a repo is cloned, it is named a random UUID instead of the final folder name, so it can be checked for conflicts before commiting.
 * This class manages that
 *
 */
class RepoCloneCache {
	constructor() {
		this._clones = new Map();
		this._usedDirs = new Set(); // list of directories that have been occupied by active repo clones
	}
	
	/**
	 * Clones a repo and adds to cache
	 */
	async add( options, name, module ) {
		const rootPath = await util.getPackageRootPath( options.cwd );
		const repoUrl = util.parseRepositoryUrl( module.repo );
		// check if "name" is already checked out
		if ( fs.existsSync( path.join( module.dir, '.git' ) ) ) {
			// "name" has already been cloned in previous operation, see if it's the same one
			switch ( hasRepoChanged( module.repo, module.dir ) ) {
			case 'url':
				// repo is different origin URL. Check out separetely to new dir
				const checkoutPath = path.join( rootPath, module.id );
				const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
				await git.clone( repoUrl.url, checkoutPath, targetObj );
				this._clones.set( module.id, { dir: checkoutPath, module } );
				break;
			case 'target':
				// branch / tag has changed. Switch over if this directory hasn't already been used
				if ( !this._usedDirs.has( module.dir ) ) {
					// already existing version has not been used already, use that cloned repo to do a switch
					const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
					const stashName = await git.stash( module.dir );
					await git.pull( module.dir );
					await git.checkout( module.dir, targetObj );
					await git.stashPop( module.dir, stashName );
					this._clones.set( module.id, { dir: module.dir, module } );
					this._usedDirs.add( module.dir );
				} else {
					// already checked out version has been used by previous repo, so clone a new copy (by copying previous clone)
					const checkoutPath = path.join( rootPath, module.id );
					fs.copySync( module.dir, checkoutPath );
					await git.pull( checkoutPath );
					await git.checkout( checkoutPath, targetObj );
					await git.stashPop( module.dir, stashName );
					this._clones.set( module.id, { dir: checkoutPath, module } );
				}
				break;
			default: // not changed
				// repo is the same - do an update
				if ( !this._usedDirs.has( module.dir ) ) {
					const stashName = await git.stash( module.dir );
					await git.pull( module.dir );
					await git.stashPop( module.dir, stashName );
					this._usedDirs.add( module.dir );
				}
				this._clones.set( module.id, { dir: module.dir, module } );
				break;
			}
		} else {
			// clone repo to normal dir
			const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
			await git.clone( repoUrl.url, module.dir, targetObj );
			this._clones.set( module.id, { dir: module.dir, module } );
			this._usedDirs.add( module.dir );
		}
	}
	
	/**
	 * Renames cloned modules to their final folder names and deletes any not used
	 */
	async commit() {
		
	}
}


export default new RepoCloneCache();
