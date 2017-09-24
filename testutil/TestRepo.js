// creates a local git repo and allows tests for certain dependencies existing etc.
import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';
import * as git from '../lib/git.js';
import chai from 'chai';

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
			name: 'main2',
			version: '0.2.0-snapshot.0',
			files: [
				{
					path: 'file2.0.2.0.txt',
					contents: 'this is on the main2 project v0.2.0'
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
			name: 'main2',
			version: '0.2.0-snapshot.0',
			files: [
				{
					path: 'file2.0.2.0.txt',
					contents: 'this is on the main2 project v0.2.0'
				}
			]
		},
		{
			name: 'main3',
			version: '0.3.0-snapshot.0',
			files: [
				{
					path: 'file3.0.3.0.txt',
					contents: 'this is on the main2 project v0.3.0'
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
					name: 'main2',
					version: '0.1.0',
					tag: '0.1.0',
					files: [
						{
							path: 'file2.txt',
							contents: 'this is on the main2 project v0.1.0'
						}
					]
				},
				{
					name: 'main3',
					version: '0.2.0',
					files: [
						{
							path: 'file3.txt',
							contents: 'this is on the main2 project v0.2.0'
						}
					],
					modules: [
						{
							name: 'main2',
							version: '0.2.0',
							tag: '0.2.0',
							files: [
								{
									path: 'file2.txt',
									contents: 'this is on the main2 project v0.2.0'
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
			name: 'main2',
			version: '0.2.0-snapshot.0',
			files: [
				{
					path: 'file2.txt',
					contents: 'this is on the main2 project'
				}
			],
			modules: [
				{
					name: 'main3',
					version: '0.3.0-snapshot.0',
					files: [
						{
							path: 'file3.txt',
							contents: 'this is on the main3 project'
						}
					],
					modules: [
						{
							name: 'main4',
							version: '0.4.0-snapshot.0',
							files: [
								{
									path: 'file4.txt',
									contents: 'this is on the main4 project'
								}
							]
						}
					]
				}
			]
		},
		{
			name: 'main5',
			version: '0.5.0-snapshot.0',
			files: [
				{
					path: 'file5.txt',
					contents: 'this is on the main5 project'
				}
			],
			modules: [
				{
					name: 'main6',
					version: '0.6.0-snapshot.0',
					files: [
						{
							path: 'file6.txt',
							contents: 'this is on the main6 project'
						}
					]
				}
			]
		}
	]
};

class TestRepo {
	constructor() {
		this._project = null;
	}
	
	_getDependencyDir( depName ) {
		// TODO: support for different module directories?
		return path.join( this._project.checkoutDir, 'flavio_modules', depName );
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
	
	static templateDescriptor( name ) {
		switch ( name ) {
			case 'none':
				return _.cloneDeep( templateNone );
			case 'one':
				return _.cloneDeep( templateOne );
			case 'two':
				return _.cloneDeep( templateTwo );
			case 'simpleNest':
				return _.cloneDeep( templateSimpleNest );
			case 'complexNest':
				return _.cloneDeep( templateComplexNest );
			default:
				throw new Error( `No template ${name} defined` );
		}
	}
	
	/**
	 * @param {Object} descriptor - JSON object describing how the repo will look
	 */
	async init( tempDir, descriptor ) {
		this._project = await git.addProject( tempDir, descriptor );
	}
	
	/**
	 * Throws an exception if the given dependency target does not match the one supplied
	 */
	async assertDependencyTarget( depName, target ) {
		const dir = this._getDependencyDir( depName );
		chai.assert.ok( fs.existsSync( dir ), `Dependency directory ${depName} exists [$dir]` );
		chai.assert.ok( fs.existsSync( path.join( dir, '.git' ) ), `Dependency directory ${depName} '.git' folder exists [$dir]` );
		
		if ( target ) {
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

export TestRepo;
