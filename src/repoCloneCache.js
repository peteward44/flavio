import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';
import * as git from './git.js';
import * as resolve from './resolve.js';

/**
 * @returns {Promise.<string>} - Either 'url', 'target' or empty string, depending what has changed on the repo
 */
async function hasRepoChanged( repo, dir ) {
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


function getDirs( root ) {
	const leaves = fs.readdirSync( root );
	let dirs = [];
	for ( const leaf of leaves ) {
		const fullPath = path.join( root, leaf );
		if ( fs.statSync( fullPath ).isDirectory() ) {
			dirs.push( fullPath );
		}
	}
	return dirs;
}


/**
 * When a repo is cloned, it is named a random UUID instead of the final folder name, so it can be checked for conflicts before commiting.
 * This class manages that
 *
 */
class RepoCloneCache {
	constructor() {
		this._availableClonedRepos = new Map(); // Map of repo base URL's to checkout folders, which have not been used yet
		this._clones = new Map(); // Map of repo target URLs to checkout folders which have been used
		this._usedDirs = new Set(); // list of directories that have been occupied by active repo clones
	}
	
	/**
	 * Scans the component directory to find which repos we already have cloned, and adds them to the available repo map
	 */
	async init( options ) {
		const rootPath = await util.getPackageRootPath( options.cwd );
		const dirs = getDirs( rootPath );
		for ( const dir of dirs ) {
			if ( fs.existsSync( path.join( dir, '.git' ) ) ) {
				const localUrl = await git.getWorkingCopyUrl( dir, true );
				if ( !this._availableClonedRepos.has( localUrl ) ) {
					this._availableClonedRepos.set( localUrl, [] );
				}
				this._availableClonedRepos.get( localUrl ).push( path.basename( dir ) );
			}
		}
	}
	
	/**
	 * Checks to see if we already have a cloned repo for this module or clones a fresh one if required
	 *
	 * @returns {string} - Directory name inside the package root path of repo
	 */
	async _lockRepo( options, url, module ) {
		if ( this._clones.has( module.repo ) ) {
			// already checked out this repo & target - use the same one
			return this._clones.get( module.repo );
		}
		
		const rootPath = await util.getPackageRootPath( options.cwd );
		
		// see if this repo is already cloned and is available to use
		if ( this._availableClonedRepos.has( url ) ) {
			const dirsArray = this._availableClonedRepos.get( url );
			if ( dirsArray.length > 0 ) {
				let index = dirsArray.indexOf( path.basename( module.dir ) );
				// look to see if the same directory name is available and prefer to use that one.
				if ( index < 0 ) {
					// otherwise use another one
					index = 0;
				}
				const dir = dirsArray.splice( index, 1 )[0];
				this._clones.set( module.repo, dir );
				return dir;
			}
		}
		// check out new one if none available
		const checkoutPath = path.join( rootPath, module.id );
		const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
		await git.clone( repoUrl.url, checkoutPath, targetObj );
		this._clones.set( module.repo, module.id );
		return module.id;
	}
	
	/**
	 * Clones a repo and adds to cache
	 */
	async add( options, name, module ) {
		const repoUrl = util.parseRepositoryUrl( module.repo );
		const dirname = await this._lockRepo( options, repoUrl.url, module );
	
		switch ( await hasRepoChanged( module.repo, dirname ) ) {
		case 'url':
			// repo is different origin URL. This shouldn't happen
			throw new Error( `Logic error: Repo URL is different from expected ${module.repo}` );
			break;
		case 'target':
			// already existing version has not been used already, use that cloned repo to do a switch
			const targetObj = await resolve.getTargetFromRepoUrl( module.repo );
			const stashName = await git.stash( module.dir );
			await git.pull( module.dir );
			await git.checkout( module.dir, targetObj );
			await git.stashPop( module.dir, stashName );
			break;
		default: // not changed
			// repo is the same - do an update
			const stashName = await git.stash( module.dir );
			await git.pull( module.dir );
			await git.stashPop( module.dir, stashName );
			break;
		}
	}
	
	/**
	 * Renames cloned modules to their final folder names and deletes any not used
	 */
	async commit() {
		
	}
}


export default new RepoCloneCache();
