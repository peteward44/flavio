// creates a local git repo and allows tests for certain dependencies existing etc.
import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';
import chai from 'chai';
import * as git from '../src/git.js';

const templateNone = {
	name: 'main',
	version: '0.1.0-snapshot.0',
	files: [
		{
			path: 'file.txt',
			contents: 'this is on the main project'
		}
	],
	modules: [
	]
};

const templateOne = {
	name: 'main',
	version: '0.1.0-snapshot.0',
	files: [
		{
			path: 'file.txt',
			contents: 'this is on the main project'
		}
	],
	modules: [
		{
			name: 'dep1',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			]
		}
	]
};

const templateTwo = {
	name: 'main',
	version: '0.1.0-snapshot.0',
	files: [
		{
			path: 'file.txt',
			contents: 'this is on the main project'
		}
	],
	modules: [
		{
			name: 'dep1',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			]
		},
		{
			name: 'dep2',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			]
		}
	]
};

const templateSimpleNest = {
	name: 'main',
	version: '0.1.0-snapshot.0',
	files: [
		{
			path: 'file.txt',
			contents: 'this is on the main project'
		}
	],
	modules: [
		{
			name: 'dep1',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			]
		},
		{
			name: 'dep2',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			],
			modules: [
				{
					name: 'dep2-1',
					version: '0.1.0-snapshot.0',
					files: [
						{
							path: 'file.txt',
							contents: 'contents'
						}
					]
				}
			]
		}
	]
};

const templateComplexNest = {
	name: 'main',
	version: '0.1.0-snapshot.0',
	files: [
		{
			path: 'file.txt',
			contents: 'this is on the main project'
		}
	],
	modules: [
		{
			name: 'dep1',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			],
			modules: [
				{
					name: 'dep1-1',
					version: '0.1.0-snapshot.0',
					files: [
						{
							path: 'file.txt',
							contents: 'contents'
						}
					],
					modules: [
						{
							name: 'dep1-1-1',
							version: '0.1.0-snapshot.0',
							files: [
								{
									path: 'file.txt',
									contents: 'contents'
								}
							]
						}
					]
				}
			]
		},
		{
			name: 'dep2',
			version: '0.1.0-snapshot.0',
			files: [
				{
					path: 'file.txt',
					contents: 'contents'
				}
			],
			modules: [
				{
					name: 'dep2-1',
					version: '0.1.0-snapshot.0',
					files: [
						{
							path: 'file.txt',
							contents: 'contents'
						}
					]
				}
			]
		}
	]
};

class TestRepo {
	/*
	project object should look like
		repoDir,
		checkoutDir,
		deps: {},
		alldeps: {}
	*/
	constructor( repoDir, checkoutDir ) {
		if ( repoDir && checkoutDir ) {
			this._project = {
				repoDir,
				checkoutDir
			};
		} else {
			this._project = null;
		}
	}
	
	_getDependencyDir( depName ) {
		// TODO: support for different module directories?
		if ( depName === 'main' ) {
			return this._project.checkoutDir;
		} else {
			return path.join( this._project.checkoutDir, 'flavio_modules', depName );
		}
	}
	
	/**
	 * 		repoDir,
		checkoutDir,
		deps: {},
		alldeps: {}
	*/
	get project() {
		return this._project;
	}
	
	static templateDescriptor( name, merge = {} ) {
		switch ( name ) {
			case 'none':
				return _.merge( {}, templateNone, merge );
			case 'one':
				return _.merge( {}, templateOne, merge );
			case 'two':
				return _.merge( {}, templateTwo, merge );
			case 'simpleNest':
				return _.merge( {}, templateSimpleNest, merge );
			case 'complexNest':
				return _.merge( {}, templateComplexNest, merge );
			default:
				throw new Error( `No template ${name} defined` );
		}
	}
	
	/**
	 * @param {Object} descriptor - JSON object describing how the repo will look
	 */
	async _init( tempDir, descriptor ) {
		this._project = await git.addProject( tempDir, descriptor );
	}
	
	static async create( tempDir, name, merge = {} ) {
		const descriptor = TestRepo.templateDescriptor( name, merge );
		const testRepo = new TestRepo();
//		console.log( "descriptor", JSON.stringify( descriptor, null, 2 ) );
		await testRepo._init( tempDir, descriptor ); // eslint-disable-line no-underscore-dangle
		return testRepo;
	}
	
	/**
	 * Throws an exception if the given dependency target does not match the one supplied
	 */
	async assertDependencyTarget( depName, target ) {
		await this.assertDependencyExists( depName );
		
		if ( target ) {
			const dir = this._getDependencyDir( depName );
			const actualTarget = await git.getCurrentTarget( dir );
			if ( target.branch ) {
				chai.assert.equal( actualTarget.branch, target.branch, `${depName} has expected branch checked out [$dir]` );
			}
			if ( target.tag ) {
				chai.assert.equal( actualTarget.tag, target.tag, `${depName} has expected tag checked out [$dir]` );
			}
			if ( target.commit ) {
				chai.assert.equal( actualTarget.commit, target.commit, `${depName} has expected commit checked out [$dir]` );
			}
		}
	}
	
	async assertDependencyExists( depName ) {
		const dir = this._getDependencyDir( depName );
		chai.assert.ok( fs.existsSync( dir ), `Dependency directory ${depName} exists [$dir]` );
		chai.assert.ok( fs.existsSync( path.join( dir, '.git' ) ), `Dependency directory ${depName} '.git' folder exists [$dir]` );
	}
	
	async assertDependencyNotExists( depName ) {
		const dir = this._getDependencyDir( depName );
		chai.assert.ok( !fs.existsSync( dir ), `Dependency directory ${depName} does not exist [$dir]` );
		chai.assert.ok( !fs.existsSync( path.join( dir, '.git' ) ), `Dependency directory ${depName} '.git' folder does not exist [$dir]` );
	}
	
	async assertTagExists( depName, tagName ) {
		const dir = this._getDependencyDir( depName );
		chai.assert.ok( await git.tagExists( dir, tagName ), `${depName} has tag ${tagName} [$dir]` );
	}
	
	async assertTagNotExists( depName, tagName ) {
		const dir = this._getDependencyDir( depName );
		chai.assert.ok( !await git.tagExists( dir, tagName ), `${depName} has no tag ${tagName} [$dir]` );
	}
	
	async assertDependencyUpToDate( depName ) {
		const dir = this._getDependencyDir( depName );
		chai.assert.ok( await git.isUpToDate( dir ), `${depName} is up to date with it's upstream branch [$dir]` );
	}
}

export default TestRepo;
