import update from './commands/update.js';
import add from './commands/add.js';
import tag from './commands/tag.js';
import taginfo from './commands/taginfo.js';
import tagdep from './commands/tagdep.js';
import clone from './commands/clone.js';
import status from './commands/status.js';
import execute from './commands/execute.js';
import exportProject from './commands/exportProject.js';
import checkout from './commands/checkout.js';
import when from './commands/when.js';
import init from './commands/init.js';
import clear from './commands/clear.js';

const commands = {
	update,
	add,
	clear,
	tag,
	tagdep,
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
