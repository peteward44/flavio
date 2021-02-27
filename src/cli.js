import _ from 'lodash';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import moment from 'moment';
import pkgJson from '../package.json';
import flavio from './index.js';
import * as util from './util.js';

moment.suppressDeprecationWarnings = true;

export default function start() {
	return new Promise((resolve, reject) => {
		yargs(hideBin(process.argv)) // eslint-disable-line no-unused-expressions
			.usage('Usage: flavio <command> [options]')
			.example('flavio update', 'clones/checks out and/or updates all dependencies for project')
			.example('flavio add user@server:/var/repo.git', 'clones/checks out repo.git and any dependencies, adds repo.git to dependency list')
			.help('help')
			.alias( 'h', 'help' )
			.alias( 'v', 'version' )
			.option('link', {
				describe: 'Dependencies are cloned in a common directory then symbolic links are created in the flavio_dependencies directory',
				boolean: true,
				default: true
			})
			.option('linkdir', {
				describe: 'Directory to use for dependencies when using --link option',
				string: true,
				default: util.getDefaultLinkDir()
			})
			.version(pkgJson.version)
			.command( {
				command: 'update',
				desc: 'Installs and updates all dependencies',
				builder: (subyargs) => {
					subyargs
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
							boolean: true,
							default: true
						})
						.option('switch', {
							describe: 'For dependencies that are already checked out, switch the branch to the one specified in flavio.json',
							boolean: true,
							default: false
						})
						.option('remote-reset', {
							describe: 'If a local branch has no remote equivalent, it will be reset to master',
							boolean: true,
							default: true
						})
						.option('json', {
							describe: 'Output machine-readable result in JSON',
							boolean: true,
							default: false
						})
						.option('depth', {
							describe: '--depth option to pass to git when cloning a fresh repository. Use zero or negative value to get entire history',
							number: true,
							default: undefined
						})
						.option('ignore-dependencies', {
							describe: 'Only perform commands on the main repository (not on any dependencies)',
							boolean: true,
							default: false
						});
				},
				handler: (argv) => {
					flavio.commands.update( _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			} )
			.command( {
				command: 'add <name> <url>',
				desc: 'Adds a new dependency',
				builder: ( subyargs ) => {
					subyargs
						.usage('Usage: flavio add [options] <name> <repourl>')
						.example('flavio add My_Repo http://github.com/myuser/myrepo.git#0.2.0', 'Adds myrepo.git to dependency list using the name My_Repo')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					flavio.commands.add( argv.name, argv.url, _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			} )
			.command( {
				command: 'status',
				desc: 'Prints out dependency status to console',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio status [options]')
						.example('flavio status', 'Prints out dependency status')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						})
						.option('nofetch', {
							describe: 'If you want a quicker response, use this flag to disable the git fetch command.',
							boolean: true,
							default: false
						});
				},
				handler: (argv) => {
					flavio.commands.status( _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			})
			.command( {
				command: 'execute',
				desc: 'Executes a git command on main project and all dependencies - use with caution',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio execute -- [<command>]')
						.example('flavio execute -- reset --hard', 'Hard resets all repos')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					flavio.commands.execute( _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			})
			.command( {
				command: 'checkout <branch>',
				desc: 'If a branch exists for a dependency, will checkout',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio checkout [<branch>]')
						.example('flavio branch my-branch-name', 'Checks out given branch on all dependencies')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					flavio.commands.checkout( argv.branch, _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			})
			.command( {
				command: 'when <date..>',
				desc: 'Attempts to set all dependencies to their state at the given date & time',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio when <date>')
						.example('flavio when 20180512 0633', 'Sets the repo to the state at 2018-05-21 06:33. Can accept any format string moment.js supports')
						.help('help')
						.option('format', {
							describe: 'Format of date string used'
						})
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					const dateString = argv.date.join( " " );
					const date = moment( dateString, argv.format );
					if ( date.isValid() ) {
						flavio.commands.when( date, _.cloneDeep( argv ) )
							.then(resolve)
							.catch(reject);
					} else {
						console.error( `"${dateString}" not a valid date: Use format YYYY-MM-DD HH:SS` );
					}
				}
			})
			.command( {
				command: 'tag',
				desc: 'Tags main project as well as any dependencies',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio tag [options]')
						.example('flavio tag', 'Creates a tag for main project and all linked dependencies')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						})
						.option('increment', {
							describe: 'semver release type to increment version on tag. Set to false for no increment',
							type: 'string'
						})
						.option('interactive', {
							describe: 'Set to false so the user is not prompted any questions',
							boolean: true,
							default: true
						});
				},
				handler: (argv) => {
					flavio.commands.tag(_.cloneDeep( argv ))
						.then(resolve)
						.catch(reject);
				}
			} )
			.command( {
				command: 'export <directory>',
				desc: 'Export main project and all modules to a provided output directory',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio export <output directory> [options]')
						.example('flavio export /home/user/myexport', 'Exports main project and all modules')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					flavio.commands.export( argv.directory, _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			})
			.command( {
				command: 'clear',
				desc: 'Deletes linked dependency repositories for this project',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio clear')
						.example('flavio clear', 'Deletes linked dependency repositories for this project')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					flavio.commands.clear( _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			})
			.command( {
				command: 'clearall',
				desc: 'Deletes all linked dependency repositories for all projects',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio clearall')
						.example('flavio clearall', 'Deletes all linked dependency repositories for all projects')
						.help('help');
				},
				handler: (argv) => {
					flavio.commands.clear( _.cloneDeep(argv), true)
						.then(resolve)
						.catch(reject);
				}
			} )
			.command( {
				command: 'clone <url>',
				desc: 'Clones / Checks out fresh project and installs all dependencies',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio clone <url> [options]')
						.example('flavio clone user@server:/var/repo.git', 'Clones / checks out repo.git and any dependencies')
						.help('help')
						.option('cwd', {
							describe: 'Directory to check project out to - defaults to the project name inferred from the project URL',
							type: 'string'
						})
						.option('force', {
							describe: 'Do not fail if directory already exists',
							type: 'boolean',
							default: false
						})
						.option('depth', {
							describe: '--depth option to pass to git when cloning a fresh repository. Use zero or negative value to get entire history',
							number: true,
							default: undefined
						});
				},
				handler: (argv) => {
					flavio.commands.clone( argv.url, _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			} )
			.command( {
				command: 'init',
				desc: 'Initialises a flavio project',
				builder: (subyargs) => {
					subyargs
						.usage('Usage: flavio init [options]')
						.example('flavio init', 'Initialises a flavio project')
						.help('help')
						.option('cwd', {
							describe: 'Working directory to use',
							default: process.cwd()
						});
				},
				handler: (argv) => {
					flavio.commands.init( _.cloneDeep( argv ) )
						.then(resolve)
						.catch(reject);
				}
			} )
			.strictCommands()
			.demandCommand(1)
			.recommendCommands()
			.epilog('Use "flavio <command> --help" for help on specific commands')
			.argv;
	});
}
