import update from './update.js';
import add from './add.js';
import tag from './tag.js';
import clone from './clone.js';
import status from './status.js';
import execute from './execute.js';
import exportProject from './exportProject.js';

// import branch from './branch.js';

const commands = {
	update,
	add,
	tag,
	clone,
	status,
	execute,
	// branch,
	'export': exportProject
};

export default {
	commands
};
