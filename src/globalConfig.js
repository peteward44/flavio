import fs from 'fs';
import path from 'path';
import _ from 'lodash';

class GlobalConfig {
	constructor() {
		this._cwd = '';
		this._config = null;
	}
	
	async init( cwd ) {
		this._cwd = cwd;
		try {
			const rc = path.join( this._cwd, '.flaviorc' );
			if ( fs.existsSync( rc ) ) {
				this._config = JSON.parse( fs.readFileSync( rc ) );
			}
		} catch ( err ) {
		}
	}

	getPackageRootPath() {
		// read from .flaviorc
		if ( _.isString( this._config?.directory ) ) {
			return path.join( this._cwd, this._config.directory );
		}
		return path.join( this._cwd, 'flavio_modules' );
	}
}

export default new GlobalConfig();
