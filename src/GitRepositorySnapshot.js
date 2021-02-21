import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { memoize } from 'lodash-decorators';
import * as uuid from 'uuid';
import globalConfig from './globalConfig.js';

function printError( err, args, cwd ) {
	let argsString = args.join( " " );
	console.error( `'git ${argsString}'` );
	console.error( `'dir ${cwd}'` );
	console.error( err.stack || err );
}

async function getDirForDependency( name ) {
	const root = globalConfig.getPackageRootPath();
	return path.join( root, name );
}

function debug( str ) {
	console.error( str );
}

// Takes a status snapshot of a git cloned repository. Note this may cache data even if it
// has changed underneath. If you change a git repository, you should discard any GitRepositorySnapshot instances
// you may have and recreate them
class GitRepositorySnapshot {
	constructor( name, dir ) {
		this._name = name;
		this._dir = dir;
	}
	
	get name() {
		return this._name;
	}
	
	get dir() {
		return this._dir;
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
	
	@memoize()
	async getStatus() {
		if ( !fs.existsSync( path.join( this._dir, '.git' ) ) ) {
			return 'missing';
		} else {
			return 'installed';
		}
	}
	
	@memoize()
	async getFlavioJson() {
		const p = path.join( this._dir, 'flavio.json' );
		if ( fs.existsSync( p ) ) {
			return JSON.parse( fs.readFileSync( p, 'utf8' ).toString() );
		}
		return null;
	}
	
	@memoize()
	async getDependencies() {
		const flavioJson = await this.getFlavioJson();
		if ( flavioJson ) {
			return flavioJson.dependencies || {};
		}
		return {};
	}

	@memoize()
	async getTarget() {
		debug( 'getCurrentTarget' );
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
	
	@memoize()
	async getUrl( bare = false ) {
		debug( 'getWorkingCopyUrl' );
		if ( await this.getStatus() === 'missing' ) {
			return '';
		}
		// git is a bit more complicated than svn as a repo can have multiple remotes.
		// always assume 'origin' - TODO: allow an option to change this behaviour
		const result = await this._executeGit( ['config', '--get', 'remote.origin.url'], { captureStdout: true } );
		const url = result.out.trim();
		const target = await this.getTarget();
		return bare ? url : `${url}#${target.branch || target.tag || target.commit}`;
	}
	
	@memoize()
	async isConflicted() {
		debug( 'isConflicted' );
		if ( await this.getStatus() === 'missing' ) {
			return false;
		}
		const output = ( await this._executeGit( ['ls-files', '--unmerged'], { captureStdout: true } ) ).out;
		return output.trim().length > 0;
	}
	
	@memoize()
	async isWorkingCopyClean( filename ) {
		debug( 'isWorkingCopyClean' );
		if ( await this.getStatus() === 'missing' ) {
			return false;
		}
		let args = ['diff', 'HEAD'];
		if ( filename ) {
			args.push( '--' );
			if ( Array.isArray( filename ) ) {
				args = args.concat( filename );
			} else {
				args.push( filename );
			}
		}
		let { out } = await this._executeGit( args, { captureStdout: true } );
		out.trim();
		return out.length === 0;
	}
	
	@memoize()
	async isUpToDate() {
		debug( 'isUpToDate' );
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
	
	@memoize()
	async getRemoteTrackingBranch() {
		const branch = ( await this._executeGit( ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { captureStdout: true } ) ).out;
		return branch.trim();
	}
	
	@memoize()
	async fetch() {
		debug( 'fetch' );
		if ( await this.getStatus() === 'missing' ) {
			return;
		}
		await this._executeGit( ['fetch'], { outputStderr: true } );
	}
	
	@memoize()
	async pull() {
		debug( 'pull' );
		if ( await this.getStatus() === 'missing' ) {
			return null;
		}
		let result = null;
		const target = await this.getTarget();
		if ( target.branch ) {
			await this.fetch();
			const remoteBranch = await this.getRemoteTrackingBranch();
			result = await this._executeGit( [`merge`, remoteBranch], { outputStderr: true } );
		}
		return result;
	}

	async push() {
		debug( 'push' );
		if ( await this.getStatus() === 'missing' ) {
			return;
		}
		await this._executeGit( ['push'], { outputStderr: true } );
	}

	/** Lists all the tags that are part of the repository
	 * @param {string} url URL
	 */
	@memoize()
	async listTags() {
		debug( 'listTags' );
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

	_executeGit( args, options = {} ) {
		const that = this;
		options = options || {};
		return new Promise( ( resolve, reject ) => {
			let connected = true;
			let stdo = '';
			let stde = '';
			console.log( `Executing git ${args.join(" ")} [dir=${this._dir}]` );
			let stderr = 'inherit';
			if ( options.captureStderr ) {
				stderr = 'pipe';
			} else if ( options.outputStderr ) {
				stderr = 'inherit';
			}
			let proc = spawn( 'git', args, { cwd: this._dir, stdio: ['ignore', options.captureStdout ? 'pipe' : 'inherit', stderr] } );

			function unpipe( code ) {
				if ( !connected ) {
					return;
				}
				connected = false;
				if ( code !== 0 && !options.ignoreError ) {
					if ( !options.quiet ) {
						printError( '', args, that._dir ); // eslint-disable-line no-underscore-dangle
					}
					reject( new Error( "Error running git" ) );
				} else {
					resolve( { out: stdo, err: stde, code: code } );
				}
			}

			if ( options.captureStdout ) {
				proc.stdout.on( 'data', ( data ) => {
					stdo += data.toString();
				} );
			}
			if ( options.captureStderr ) {
				proc.stderr.on( 'data', ( data ) => {
					stde += data.toString();
				} );
			}
			proc.on( 'error', ( err ) => {
				if ( options.ignoreError ) {
					resolve( { out: stdo, err: stde, code: 0 } );
				} else {
					console.log( stde );
					if ( !options.quiet ) {
						printError( err, args, this._dir );
					}
					reject( new Error( err ) );
				}
			} );
			proc.on( 'exit', ( code ) => {
				unpipe( code );
			} );
			proc.on( 'close', ( code ) => {
				unpipe( code );
			} );
		} );
	}
}

export default GitRepositorySnapshot;
