import fs from 'fs-extra';
import path from 'path';
import * as uuid from 'uuid';
import globalConfig from './globalConfig.js';
import executeGit from './executeGit.js';
import logger from './logger.js';

async function getDirForDependency( name ) {
	const root = globalConfig.getPackageRootPath();
	return path.join( root, name );
}

function debug( str ) {
	logger.log( 'debug', str );
}

function cached() {
	return function( target, name, descriptor ) {
		const original = descriptor.value;
		if ( typeof original === 'function' ) {
			descriptor.value = function(...args) {
				if ( !this._cache.has( name ) ) {
					debug( `Calling GitRepositorySnapshot.${name}: ${this.name}` );
					const result = original.apply( this, args );
					this._cache.set( name, result );
				}
				return this._cache.get( name );
			};
		}
		return descriptor;
	};
}

// Takes a status snapshot of a git cloned repository. Note this may cache data even if it
// has changed underneath. If you change a git repository, you should discard any GitRepositorySnapshot instances
// you may have and recreate them
class GitRepositorySnapshot {
	constructor( name, dir ) {
		this._name = name;
		this._dir = dir;
		this._cache = new Map();
		this._changeID = 0;
	}
	
	get name() {
		return this._name;
	}
	
	get dir() {
		return this._dir;
	}
	
	get changeID() {
		return this._changeID;
	}
	
	static async fromDir( dir ) {
		const snapshot = new GitRepositorySnapshot( '', dir );
		snapshot._name = ( await snapshot.getFlavioJson() )?.name || 'unknown'; // eslint-disable-line no-underscore-dangle
		return snapshot;
	}
	
	static async fromName( name ) {
		const dir = await getDirForDependency( name );
		return new GitRepositorySnapshot( name, dir );
	}
	
	markChanged() {
		this._changeID++;
	}
	
	@cached()
	async getChildren( allDeps ) {
		const map = new Map();
		const deps = await this.getDependencies();
		for ( const name of Object.keys( deps ) ) {
			map.set( name, allDeps.get( name ) );
		}
		return map;
	}

	@cached()
	async getStatus() {
		if ( !fs.existsSync( path.join( this._dir, '.git' ) ) ) {
			return 'missing';
		} else {
			return 'installed';
		}
	}

	@cached()
	async getFlavioJson() {
		const p = path.join( this._dir, 'flavio.json' );
		if ( fs.existsSync( p ) ) {
			return JSON.parse( fs.readFileSync( p, 'utf8' ).toString() );
		}
		return null;
	}
	
	@cached()
	async getDependencies() {
		const flavioJson = await this.getFlavioJson();
		if ( flavioJson ) {
			return flavioJson.dependencies || {};
		}
		return {};
	}

	@cached()
	async getTarget() {
		if ( await this.getStatus() === 'missing' ) {
			return null;
		}
		// from http://stackoverflow.com/questions/18659425/get-git-current-branch-tag-name
		// check for branch name
		try {
			let result = ( await this._executeGit( ['symbolic-ref', '--short', '-q', 'HEAD'], { ignoreError: true, captureStdout: true } ) );
			let name = result.out.trim();
			if ( result.code === 0 && name.length > 0 ) {
				return { branch: name };
			}
		} catch ( e ) {}

		// then check if it's pointing at a tag
		try {
			const tagResult = await this._executeGit( ['describe', '--tags', '--exact-match'], { ignoreError: true, captureStdout: true } );
			const tag = tagResult.out.trim();
			if ( tagResult.code === 0 && tag.length > 0 ) {
				return { tag };
			}
		} catch ( e ) {}

		// then the repo is probably in detached head state pointing a particular commit
		try {
			const commitResult = await this._executeGit( ['rev-parse', '--verify', 'HEAD'], { ignoreError: true, captureStdout: true } );
			const commit = commitResult.out.trim();
			if ( commitResult.code === 0 && commit.length > 0 ) {
				return { commit };
			}
		} catch ( e ) {}
		
		throw new Error( `getTarget() - Could not determine target for repo ${this._name}` );
	}
	
	@cached()
	async getBareUrl() {
		if ( await this.getStatus() === 'missing' ) {
			return '';
		}
		// git is a bit more complicated than svn as a repo can have multiple remotes.
		// always assume 'origin' - TODO: allow an option to change this behaviour
		const result = await this._executeGit( ['config', '--get', 'remote.origin.url'], { captureStdout: true } );
		const url = result.out.trim();
		return url;
	}
	
	@cached()
	async getUrl() {
		if ( await this.getStatus() === 'missing' ) {
			return '';
		}
		const url = await this.getBareUrl();
		const target = await this.getTarget();
		return `${url}#${target.branch || target.tag || target.commit}`;
	}

	@cached()
	async isConflicted() {
		if ( await this.getStatus() === 'missing' ) {
			return false;
		}
		const output = ( await this._executeGit( ['ls-files', '--unmerged'], { captureStdout: true } ) ).out;
		return output.trim().length > 0;
	}
	
	@cached()
	async isWorkingCopyClean() {
		if ( await this.getStatus() === 'missing' ) {
			return false;
		}
		let args = ['diff', 'HEAD'];
		let { out } = await this._executeGit( args, { captureStdout: true } );
		out.trim();
		return out.length === 0;
	}
	
	@cached()
	async isUpToDate() {
		if ( await this.getStatus() === 'missing' ) {
			return false;
		}
		try {
			if ( ( await this.getTarget() ).branch ) {
				await this.fetch();
				const local = ( await this._executeGit( ['rev-parse', 'HEAD'], { quiet: true, captureStdout: true } ) ).out;
				const remote = ( await this._executeGit( ['rev-parse', '@{u}'], { quiet: true, captureStdout: true } ) ).out;
				return local.trim() === remote.trim();
			}
		} catch ( err ) {}
		return true;
	}

	@cached()
	async getRemoteTrackingBranch() {
		const branch = ( await this._executeGit( ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { captureStdout: true } ) ).out;
		return branch.trim();
	}

	/** Lists all the tags that are part of the repository
	 * @param {string} url URL
	 */
	@cached()
	async listTags() {
		let result = [];
		let out = ( await this._executeGit( ['tag'], { captureStdout: true } ) ).out.trim();
		let array = out.split( '\n' );
		for ( let i=0; i<array.length; ++i ) {
			let t = array[i].trim();
			if ( t.length > 0 ) {
				result.push( t );
			}
		}
		return result;
	}

	@cached()
	async listFiles() {
		const raw = ( await this._executeGit( ['ls-files'], { captureStdout: true } ) ).out;
		return raw.trim().split( '\n' ).map( (file) => file.trim() );
	}
	
	async executeRevList( args ) {
		try {
			const out = ( await this._executeGit( ['rev-list', ...args], { captureStdout: true } ) ).out.trim();
			if ( out ) {
				const fin = out.split( '\n' )[0].trim();
				if ( fin ) {
					return fin;
				}
			}
		} catch ( err ) {
		}
		return '';
	}
	
	async stash() {
		debug( 'stash' );
		if ( await this.getStatus() === 'missing' ) {
			return null;
		}
		let clean = await this.isWorkingCopyClean();
		const stashName = uuid.v4();
		if ( !clean ) {
			await this._executeGit( ['stash', 'save', stashName, '-u'], { quiet: true } );
			// check if it got saved
			const listOut = ( await this._executeGit( ['stash', 'list'], { quiet: true, captureStdout: true } ) ).out;
			if ( !listOut.match( stashName ) ) {
				clean = true;
			}
		}
		return clean ? null : stashName;
	}

	async stashPop( stashName ) {
		debug( 'stashPop' );
		if ( await this.getStatus() === 'missing' ) {
			return;
		}
		if ( stashName ) {
			try {
				await this._executeGit( ['stash', 'pop'], { quiet: true } );
			} catch ( err ) {
			}
		}
	}

	async addAndCommit( filename, commitMessage ) {
		debug( 'addAndCommit' );
		if ( !Array.isArray( filename ) ) {
			filename = [filename];
		}
		await this._executeGit( ['add', ...filename] );
		await this._executeGit( ['commit', '-m', commitMessage, ...filename] );
		this._cache.delete( 'listFiles' );
		this._cache.delete( 'getLastCommit' );
		this._cache.delete( 'push' );
	}
	
	async isValidCommit( sha ) {
		debug( 'isValidCommit' );
		const result = await this._executeGit( ['branch', '-r', '--contains', sha], { ignoreError: true } );
		return result.code === 0;
	}
	
	async checkout( branchName, create = false ) {
		debug( 'checkout' );
		const currentTarget = await this.getTarget();
		if ( currentTarget.branch && branchName === currentTarget.branch ) {
			return;
		}
		const stash = await this.stash();
		const args = ['checkout', branchName];
		if ( create ) {
			args.splice( 1, 0, '-b' );
		}
		await this._executeGit( args );
		await this.stashPop( stash );
		this._clearCacheExcept( ['fetch', 'getBareUrl', 'listTags'] );
	}

	async clone( url, dir = this._dir, target ) {
		dir = path.resolve( dir );
		fs.ensureDirSync( dir );
		const args = ['clone', url, dir];
		if ( target ) {
			if ( target.branch ) {
				args.push( `--branch=${target.branch}` );
			} else if ( target.tag ) {
				args.push( `--branch=tags/${target.tag}` );
			}
		}
		await this._executeGit( args, { outputStderr: true } );
		this._dir = dir;
		this._cache.clear();
		this._cache.set( 'fetch', undefined );
		this._cache.set( 'pull', undefined );
		this._cache.set( 'push', undefined );
		this.markChanged();
	}

	async initLFS() {
		debug( 'initLFS' );
		try {
			await this._executeGit( ['lfs', 'install'] );
			await this._executeGit( ['config', 'lfs.contenttype', 'false'] );
		} catch ( err ) {
			throw new Error( `LFS init failed - do you have the Git LFS client installed? [${err.message}]` );
		}
	}

	async createTag( tagName, message ) {
		debug( 'createTag' );
		await this._executeGit( ['tag', '-a', tagName, '-m', message] );
		this._cache.delete( 'push' );
		this._cache.delete( 'listTags' );
	}

	@cached()
	async fetch() {
		if ( !this._fetched ) {
			if ( await this.getStatus() === 'missing' ) {
				return;
			}
			await this._executeGit( ['fetch', '--all'], { outputStderr: true } );
			this._fetched = true;
		}
	}

	@cached()
	async pull() {
		if ( await this.getStatus() === 'missing' ) {
			return null;
		}
		let result = null;
		const target = await this.getTarget();
		if ( target.branch ) {
			await this.fetch();
			const isUpToDate = await this.isUpToDate();
			if ( !isUpToDate ) {
				const remoteBranch = await this.getRemoteTrackingBranch();
				result = await this._executeGit( [`merge`, remoteBranch], { outputStderr: true } );
				this.markChanged();
				this._clearCacheExcept( ['getBareUrl'] );
				this._cache.set( 'fetch', undefined );
				this._cache.set( 'pull', undefined );
				this._cache.set( 'push', undefined );
			}
		}
		return result;
	}

	@cached()
	async pullCaptureError() {
		if ( await this.getStatus() === 'missing' ) {
			return null;
		}
		await this.fetch();
		const remoteBranch = await this.getRemoteTrackingBranch();
		const result = await this._executeGit( [`merge`, remoteBranch], { captureStderr: true, ignoreError: true } );
		this._clearCacheExcept( ['getBareUrl'] );
		this._cache.set( 'fetch', undefined );
		this._cache.set( 'pull', undefined );
		this._cache.set( 'pullCaptureError', undefined );
		this._cache.set( 'push', undefined );
		return result.err.trim();
	}

	async push( args ) {
		if ( await this.getStatus() === 'missing' ) {
			return;
		}
		await this._executeGit( ['push', ...args], { outputStderr: true } );
	}

	@cached()
	async getLastCommit() {
		const { out } = await this._executeGit( ['log', '-n', '1', '--pretty=format:%H'], { captureStdout: true } );
		return out.trim();
	}

	async show( branch, file ) {
		debug( 'show' );
		const output = ( await this._executeGit( ['show', `${branch}:${file}`], { quiet: true, captureStdout: true } ) ).out;
		return output;
	}
	
	async reset( targetObj ) {
		// TODO: origin reference
		await this._executeGit( ['reset', '--hard', `origin/${targetObj.tag || targetObj.commit || targetObj.branch}`] );
	}

	async fixUnrelatedHistory( targetObj ) {
		try {
			await this.fetch();
		} catch ( err2 ) {
			logger.log( 'error', `Error executing fetch on repository`, err2 );
		}
		await this.reset( targetObj );
		this._cache.delete( 'pull' );
		try {
			await this.pull();
		} catch ( err2 ) {
			logger.log( 'error', `Error executing pull on repository`, err2 );
		}
		this.markChanged();
	}
	
	async doesLocalBranchExist( branchName ) {
		debug( 'doesLocalBranchExist' );
		const { code } = await this._executeGit( ['rev-parse', '--verify', branchName], { ignoreError: true } );
		return code === 0;
	}

	async doesRemoteBranchExist( branchName ) {
		debug( 'doesRemoteBranchExist' );
		await this.fetch();
		const url = await this.getBareUrl();
		const { code } = await this._executeGit( ['ls-remote', '--exit-code', url, branchName], { ignoreError: true, quiet: true } );
		return code === 0;
	}
	
	_clearCacheExcept( except ) {
		const exceptMap = new Map();
		for ( const item of except ) {
			if ( this._cache.has( item ) ) {
				exceptMap.set( item, this._cache.get( item ) );
			}
		}
		this._cache.clear();
		for ( const [item, value] of exceptMap.entries() ) {
			this._cache.set( item, value );
		}
	}
	
	execute( args ) {
		return this._executeGit( args, { outputStderr: true } );
	}

	_executeGit( args, options = {} ) {
		return executeGit( this._dir, args, options );
	}
}

export default GitRepositorySnapshot;
