import yargs from 'yargs';
import pkgJson from '../package.json';
import install from './install.js';
//import update from './update.js';
//import tag from './tag.js';
//import clone from './clone.js';
//import branch from './branch.js';
//import exportProject from './exportProject.js';

function update() {
	return Promise.resolve();
}

function tag() {
	return Promise.resolve();
}

function clone() {
	return Promise.resolve();
}

function branch() {
	return Promise.resolve();
}

function exportProject() {
	return Promise.resolve();
}

export default function start() {
	// winston.level = 'verbose';

	return new Promise((resolve, reject) => {
		yargs // eslint-disable-line no-unused-expressions
			.usage('Usage: caliber <command> [options]')
			.example('caliber install', 'clones/checks out all dependencies for project')
			.example('caliber install user@server:/var/repo.git --save', 'clones/checks out repo.git and any dependencies, adds repo.git to dependency list')
			.help('help')
			.version(() => pkgJson.version)
			.command('install', 'Performs an install', (subyargs) => {
				const options = subyargs
					.usage('Usage: caliber install <optional modules> [options]')
					.example('caliber install', 'Installs any bower dependencies')
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
					.option('production', {
						describe: 'Do not install project devDependencies',
						alias: 'p',
						default: false
					})
					.option('save', {
						describe: "Save installed packages into the project's bower.json dependencies",
						alias: 'S',
						default: false
					})
					.option('save-dev', {
						describe: "Save installed packages into the project's bower.json devDependencies",
						alias: 'D',
						default: false
					})
					.argv;
				let names;
				if (options._.length > 1) {
					names = options._.slice(1);
				}
				install(names, options)
					.then(resolve)
					.catch(reject);
			})
			.command('update', 'Performs an update', (subyargs) => {
				const options = subyargs
					.usage('Usage: caliber update <optional modules> [options]')
					.example('caliber update', 'Pulls / Updates all dependencies')
					.example('caliber update my_module my_other_module', 'Updates my_module and my_other_module dependencies')
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
					.option('production', {
						describe: 'Do not install project devDependencies',
						alias: 'p',
						default: false
					})
					.argv;
				let names;
				if (options._.length > 1) {
					names = options._.slice(1);
				}
				update(names, options)
					.then(resolve)
					.catch(reject);
			})
			.command('tag', 'Tags main project as well as any dependencies', (subyargs) => {
				const options = subyargs
					.usage('Usage: caliber tag <optional modules> [options]')
					.example('caliber tag', 'Creates a tag for main project and all linked bower dependencies')
					.example('caliber tag main', 'Creates a tag for main project only')
					.example('caliber tag my_module my_module2', 'Creates a tag for my_module and my_module2 only')
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
					.option('mergeLocalChanges', {
						describe: 'if there are uncommited local changes on a checked out tag, automatically merge back to original branch',
						type: 'boolean'
					})
					.option('commitLocalChanges', {
						describe: 'if there are uncommited local changes, automatically commit',
						type: 'boolean'
					})
					.argv;
				let names;
				if (options._.length > 1) {
					names = options._.slice(1);
				}
				tag(names, options)
					.then(resolve)
					.catch(reject);
			})
			.command('branch', 'Branches main project and/or all linked modules', (subyargs) => {
				const options = subyargs
					.usage('Usage: caliber branch <branch name> <modules> [options]')
					.example('caliber branch branch_name main', 'Creates a branch for main project only')
					.example('caliber branch branch_name my_module my_module2', 'Creates a branch for my_module and my_module2 only')
					.example('caliber branch branch_name all', 'Creates a branch for main project and all dependencies')
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
				branch(branchName, names, options)
					.then(resolve)
					.catch(reject);
			})
			.command('export', 'Export main project and all modules to a provided output directory', (subyargs) => {
				const options = subyargs
					.usage('Usage: caliber export <output directory> [options]')
					.example('caliber export /home/user/myexport', 'Exports main project and all modules')
					.help('help')
					.option('cwd', {
						describe: 'Working directory to use',
						default: process.cwd()
					})
					.demand(2)
					.argv;
				exportProject(options._[1], options)
					.then(resolve)
					.catch(reject);
			})
			.command('clone', 'Clones / Checks out fresh project and installs all dependencies', (subyargs) => {
				const options = subyargs
					.usage('Usage: caliber clone <url> [options]')
					.example('caliber clone user@server:/var/repo.git', 'Clones / checks out repo.git and any dependencies')
					.help('help')
					.demand(1)
					.option('cwd', {
						describe: 'Directory to check project out to - defaults to the project name inferred from the project URL',
						type: 'string'
					})
					.argv;

				options.url = options._[1];
				clone(options)
					.then(resolve)
					.catch(reject);
			})
			.demand(1)
			.epilog('Use "caliber <command> --help" for help on specific commands')
			.argv;
	});
}

