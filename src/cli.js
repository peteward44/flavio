import yargs from 'yargs';
import pkgJson from '../package.json';
import flavio from './index.js';

function doInstall( subyargs, resolve, reject ) {
	const options = subyargs
		.usage(`Usage: flavio update [options]`)
		.example('flavio update', 'Installs and updates all dependencies')
		.help('help')
		.option('cwd', {
			describe: 'Working directory to use',
			default: process.cwd()
		})
		.option('force-latest', {
			describe: 'Force latest version on conflict',
			alias: 'F',
			default: false
		})
		.option('interactive', {
			describe: 'Set to false so the user is not prompted any questions',
			default: true
		})
		.argv;
	flavio.commands.update(options)
		.then(resolve)
		.catch(reject);
}

export default function start() {
	// winston.level = 'verbose';

	return new Promise((resolve, reject) => {
		yargs // eslint-disable-line no-unused-expressions
			.usage('Usage: flavio <command> [options]')
			.example('flavio update', 'clones/checks out and/or updates all dependencies for project')
			.example('flavio add user@server:/var/repo.git', 'clones/checks out repo.git and any dependencies, adds repo.git to dependency list')
			.help('help')
			.version(() => pkgJson.version)
			.command('update', 'Installs and updates all dependencies', subyargs => doInstall( subyargs, resolve, reject ) )
			.command('add', 'Adds a new dependency', ( subyargs ) => {
				const options = subyargs
					.usage('Usage: flavio add [options] <name> <repourl>')
					.example('flavio add My_Repo http://github.com/myuser/myrepo.git#0.2.0', 'Adds myrepo.git to dependency list using the name My_Repo')
					.help('help')
					.option('cwd', {
						describe: 'Working directory to use',
						default: process.cwd()
					})
					.argv;
				if ( options._.length < 3 ) {
					console.error( `Not enough arguments specified for add command - Example: flavio add My_Repo https://github.com/my_repo.git` );
					resolve();
				} else {
					flavio.commands.add( options._[1], options._[2], options )
						.then(resolve)
						.catch(reject);
				}
			} )
			.command('status', 'Prints out dependency status to console', (subyargs) => {
				const options = subyargs
					.usage('Usage: flavio status [options]')
					.example('flavio status', 'Prints out dependency status')
					.help('help')
					.option('cwd', {
						describe: 'Working directory to use',
						default: process.cwd()
					})
					.argv;
				flavio.commands.status(options)
					.then(resolve)
					.catch(reject);
			})
			.command('tag', 'Tags main project as well as any dependencies', (subyargs) => {
				const options = subyargs
					.usage('Usage: flavio tag [options]')
					.example('flavio tag', 'Creates a tag for main project and all linked dependencies')
					.help('help')
					.option('cwd', {
						describe: 'Working directory to use',
						default: process.cwd()
					})
					.option('shrinkwrap', {
						describe: 'Whether to change semver ranges to fixed version numbers',
						type: 'boolean',
						default: true
					})
					.option('bumpVersion', {
						describe: 'semver release type to increment version on tag. Set to false for no increment',
						type: 'string'
					})
					.option('bumpMasterVersion', {
						describe: 'semver release type to increment version on master branch. Set to false for no increment',
						type: 'string'
					})
					.option('bumpMasterPreRelease', {
						describe: 'semver pre-release name to increment version on master branch. Set to false for no pre-release name',
						type: 'string'
					})
					.option('interactive', {
						describe: 'Set to false so the user is not prompted any questions',
						default: true
					})
					// .option('mergeLocalChanges', {
						// describe: 'if there are uncommited local changes on a checked out tag, automatically merge back to original branch',
						// type: 'boolean'
					// })
					// .option('commitLocalChanges', {
						// describe: 'if there are uncommited local changes, automatically commit',
						// type: 'boolean'
					// })
					.argv;
				flavio.commands.tag(options)
					.then(resolve)
					.catch(reject);
			})
			.command('branch', 'Branches main project and/or all linked modules', (subyargs) => {
				const options = subyargs
					.usage('Usage: flavio branch <branch name> <modules> [options]')
					.example('flavio branch branch_name main', 'Creates a branch for main project only')
					.example('flavio branch branch_name my_module my_module2', 'Creates a branch for my_module and my_module2 only')
					.example('flavio branch branch_name all', 'Creates a branch for main project and all dependencies')
					.help('help')
					.option('cwd', {
						describe: 'Working directory to use',
						default: process.cwd()
					})
					.argv;
				let branchName;
				let names;
				if (options._.length > 1) {
					branchName = options._[1];
					names = options._.slice(2);
				}
				flavio.commands.branch(branchName, names, options)
					.then(resolve)
					.catch(reject);
			})
			.command('export', 'Export main project and all modules to a provided output directory', (subyargs) => {
				const options = subyargs
					.usage('Usage: flavio export <output directory> [options]')
					.example('flavio export /home/user/myexport', 'Exports main project and all modules')
					.help('help')
					.option('cwd', {
						describe: 'Working directory to use',
						default: process.cwd()
					})
					.demand(2)
					.argv;
				flavio.commands.export(options._[1], options)
					.then(resolve)
					.catch(reject);
			})
			.command('clone', 'Clones / Checks out fresh project and installs all dependencies', (subyargs) => {
				const options = subyargs
					.usage('Usage: flavio clone <url> [options]')
					.example('flavio clone user@server:/var/repo.git', 'Clones / checks out repo.git and any dependencies')
					.help('help')
					.demand(1)
					.option('cwd', {
						describe: 'Directory to check project out to - defaults to the project name inferred from the project URL',
						type: 'string'
					})
					.argv;

				const url = options._[1];
				flavio.commands.clone( url, options )
					.then(resolve)
					.catch(reject);
			})
			.demand(1)
			.epilog('Use "flavio <command> --help" for help on specific commands')
			.argv;
	});
}

