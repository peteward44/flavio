import os from 'os';
import inquirer from 'inquirer';
import semver from 'semver';
import { execSync } from 'child_process';
import logger from './logger.js';

const gitVersionRange = '>=2.31.0';
const allowedManagers = ['manager', 'manager-core'];

async function checkCredentialManager() {
	if ( os.platform() === 'win32' ) {
		try {
			let credentialManager;
			try {
				credentialManager = execSync( `git config --global credential.helper` ).toString().trim();
			} catch ( err2 ) {
			}
			if ( allowedManagers.includes( credentialManager ) ) {
				return false;
			} else {
				if ( credentialManager ) {
					logger.error( `Warning: Credential manager '${credentialManager}' is not supported. We recommend you use the manager-core credential manager.` );
				} else {
					logger.error( `Warning: No credential manager set. We recommend you use the manager-core credential manager.` );
				}
				logger.log( 'info', `You can set this using the command "git config --global credential.helper manager-core".` );
				logger.log( 'info', `We can do that for you now if you want.` );
				const question = {
					type: 'confirm',
					name: 'q',
					message: `Change git credential manager to manager-core?`,
					default: false
				};
				const answer = await inquirer.prompt( [question] );
				if ( answer.q ) {
					try {
						execSync( `git config --global credential.helper manager-core`, { stdio: 'inherit' } );
						logger.log( 'info', `Successfully changed the git credential helper` );
						return false;	
					} catch ( err ) {
						logger.error( `Failed to set git credential helper. You will need to execute this manually`, err );
					}
				}
			}
		} catch ( err ) {
			logger.error( `Error when testing git credential manager`, err );
		}
		return true;
	}
	return false;
}

async function checkNeedWarning() {
	if ( os.platform() === 'win32' ) {
		try {
			const result = execSync( `git --version` ).toString().trim();
			const match = result.match( /(\d+\.\d+\.\d+)/ );
			if ( match ) {
				const version = semver.clean( `${match[1]}` );
				if ( semver.satisfies( version, gitVersionRange ) ) {
					return false;
				} else {
					logger.error( `Warning: Git version installed "${version}" is too old! You should download and install a new version from https://git-scm.com/download/win` );
				}
			} else {
				logger.error( `Warning: Git version could not be determined. Output from "git --version" = "${result}"` );
			}
		} catch ( err ) {
			logger.error( `Error attempting to get git version executing "git --version"`, err );
		}
		return true;
	}
	return false;
}

async function gitVersionCheck() {
	if ( await checkNeedWarning() || await checkCredentialManager() ) {
		logger.log( 'info', `You can continue, but you may encounter issues, especially around authentication failures.` );
		const question = {
			type: 'confirm',
			name: 'q',
			message: `Continue?`,
			default: false
		};
		const answer = await inquirer.prompt( [question] );
		return answer.q;
	}
	return true;
}

export default gitVersionCheck;
