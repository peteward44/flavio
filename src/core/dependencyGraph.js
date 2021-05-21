import GitRepositorySnapshot from './GitRepositorySnapshot.js';
import snapshotPool from './snapshotPool.js';

/**
 * @typedef {Object} RepositoryDefinition
 * @property {string} name - Name of repository
 * @property {string} dir - Directory/link in flavio_modules directory
 * @property {string} cloneDir - Directory in %APPDATA%\.flavio\ where module is cloned if linked, or same as "dir" property if not linked
 * @property {string} cloneURI - URL to clone project from
 * @property {Object} location - Provider-specific object supplying any extra information required (e.g. BitBucket will contain project / slug name)
 * @property {Object.<string,RepositoryDefinition>} children - Child dependencies
 */

async function walk( graph, node ) {
	const dependencies = await node.snapshot.getDependencies();
	for ( const depName of Object.keys( dependencies ) ) {
		const ref = dependencies[depName];
		const snapshot = await snapshotPool.fromName( depName, ref );
		const child = {
			snapshot,
			ref,
			children: {}
		};
		node.children[depName] = child;
		await walk( graph, child );
	}
}

export async function build( rootDir ) {
	const snapshot = await GitRepositorySnapshot.fromDir( rootDir );
	const graph = {
		root: {
			snapshot,
			ref: '',
			children: {}
		}
	};
	// build map of all dependencies - excluding ones that haven't been cloned yet. They will have a status of "missing" and their dependencies will be missing too
	await walk( graph, graph.root );
	return graph;
}

export async function flatten( graph ) {
	
}
