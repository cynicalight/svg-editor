import { describe, expect, it } from 'vitest';
import { CommandDispatcher } from '../../src/cli/CommandDispatcher.js';
import { CommandHistory } from '../../src/commands/CommandHistory.js';
import { Workspace } from '../../src/commands/Workspace.js';

describe('失败命令的原子性', () => {
  it.each(['scale scene 2', 'move scene 1e308 0'])('溢出时恢复整个分组并保留 redo：%s', async (operation) => {
    const workspace = new Workspace();
    const cli = new CommandDispatcher(workspace);
    for (const line of [
      'init', 'create g scene', 'create rect small 1 2 3 4 in scene',
      'create rect large 1e308 0 1 1 in scene', 'set small fill red', 'undo',
    ]) await cli.execute(line);
    const before = await cli.execute('tree');
    await expect(cli.execute(operation)).rejects.toThrow('invalid number: Infinity');
    expect(await cli.execute('tree')).toEqual(before);
    await cli.execute('redo');
    expect(workspace.document.require('small').getAttribute('fill')).toBe('red');
    await cli.execute('undo');
    expect(await cli.execute('tree')).toEqual(before);
  });

  it('undo/redo 执行失败时保留对应栈顶，可以重试', () => {
    const history = new CommandHistory();
    let failUndo = true;
    let failRedo = false;
    history.execute({
      execute() { if (failRedo) throw new Error('redo failed'); return 'done'; },
      undo() { if (failUndo) throw new Error('undo failed'); return 'undone'; },
    });
    expect(() => history.undo()).toThrow('undo failed');
    failUndo = false;
    expect(history.undo()).toBe('undone');
    failRedo = true;
    expect(() => history.redo()).toThrow('redo failed');
    failRedo = false;
    expect(history.redo()).toBe('done');
    expect(history.undo()).toBe('undone');
  });
});
