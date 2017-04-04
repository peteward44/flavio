import install from './install.js';

function update( options ) {
	return install( [], options, true );
}

export default update;
