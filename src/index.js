import update from './update.js';
import add from './add.js';
import tag from './tag.js';
import taginfo from './taginfo.js';
import clone from './clone.js';
import status from './status.js';
import execute from './execute.js';
import exportProject from './exportProject.js';
import checkout from './checkout.js';
import when from './when.js';
import init from './init.js';
import clear from './clear.js';

// import branch from './branch.js';

const commands = {
	update,
	add,
	clear,
	tag,
	taginfo,
	clone,
	status,
	execute,
	init,
	checkout,
	when,
	'export': exportProject
};

export default {
	commands
};
