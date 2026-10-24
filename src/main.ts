import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { Repl } from './cli/Repl.js';
import { Workspace } from './commands/Workspace.js';
import { SvgFileStore } from './io/SvgFileStore.js';
import { ShapeFactory } from './model/ShapeFactory.js';

const dispatcher = new CommandDispatcher(new Workspace(), new SvgFileStore(), new ShapeFactory());
await new Repl(dispatcher, process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY)).run();
