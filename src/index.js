import install from './install.js';
import update from './update.js';
//import tag from './tag.js';
import clone from './clone.js';
import status from './status.js';

// import branch from './branch.js';
// import exportProject from './exportProject.js';

const commands = {
	install,
	update,
//	tag,
	clone,
	status
	// branch,
	// 'export': exportProject
};

export default {
	commands
};
