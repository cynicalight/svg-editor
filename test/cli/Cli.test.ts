import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { CommandDispatcher } from '../../src/cli/CommandDispatcher.js';
import { Repl } from '../../src/cli/Repl.js';
import { Tokenizer } from '../../src/cli/Tokenizer.js';
import { Workspace } from '../../src/commands/Workspace.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'svg-cli-'));
  directories.push(path);
  return path;
}

describe('分词', () => {
  const tokenizer = new Tokenizer();
  it('保留颜色、中文、空文字以及带引号的 in', () => {
    expect(tokenizer.tokenize('  create text t 1 2 "中文 in #abc" in scene ').map((token) => token.value))
      .toEqual(['create', 'text', 't', '1', '2', '中文 in #abc', 'in', 'scene']);
    expect(tokenizer.tokenize('set t text ""').at(-1)).toEqual({ value: '', quoted: true });
    expect(tokenizer.tokenize('"in"')[0].quoted).toBe(true);
    expect(tokenizer.tokenize('create rect r 0 0 1 2 #fff').at(-1)?.value).toBe('#fff');
  });
  it('只把整行 # 视为注释，空白行跳过', () => {
    expect(tokenizer.tokenize('  # comment')).toEqual([]);
    expect(tokenizer.tokenize(' \t')).toEqual([]);
  });
  it('支持双引号和反斜线转义，保留路径中其他反斜线', () => {
    expect(tokenizer.tokenize(String.raw`set t text "a \"quote\" \\ C:\tmp"`).at(-1)?.value)
      .toBe('a "quote" \\ C:\\tmp');
  });
  it.each(['set t text "open', 'set t text "closed"extra', 'help"oops"'])('拒绝不完整语法：%s', (line) => {
    expect(() => tokenizer.tokenize(line)).toThrow();
  });
});

describe('命令分发与状态规则', () => {
  it('help 无需文档，其他文档操作要求先 init/read', async () => {
    const dispatcher = new CommandDispatcher();
    const help = await dispatcher.execute('help');
    expect(help).toContain('undo');
    expect(help).toContain('  create ellipse <id> <cx> <cy> <rx> <ry> [fill]');
    for (const command of ['tree', 'show r', 'undo', 'redo', 'canvas', 'save', 'create g scene']) {
      await expect(dispatcher.execute(command)).rejects.toThrow("no document. use 'init' or 'read' first");
    }
    await expect(dispatcher.execute('constructor')).rejects.toThrow('unknown command: constructor');
  });

  it('复现典型会话的创建、分组、移动、撤销、属性更新和删除', async () => {
    const workspace = new Workspace();
    const cli = new CommandDispatcher(workspace);
    expect(await cli.execute('init')).toEqual(['canvas 800x600 created']);
    await cli.execute('create rect bg 0 0 800 600 #ffffff');
    await cli.execute('create text title 20 40 "My Diagram"');
    await cli.execute('create circle c1 100 100 20 red');
    await cli.execute('create rect box 200 80 60 60 #3366ff');
    expect(await cli.execute('group markers c1 box')).toEqual(['g#markers created with 2 children']);
    expect(await cli.execute('move c1 30 0')).toEqual(['circle#c1 moved to (130,100)']);
    expect(await cli.execute('undo')).toEqual(['circle#c1 moved back to (100,100)']);
    expect(await cli.execute('redo')).toEqual(['circle#c1 moved to (130,100)']);
    await cli.execute('set title text "My Diagram v2"');
    await cli.execute('undo');
    expect(workspace.document.require('title').textContent).toBe('My Diagram');
    await expect(cli.execute('group bad c1 markers')).rejects.toThrow('cannot group a container into its own descendant: markers');
    await cli.execute('delete box');
    await cli.execute('undo');
    expect(workspace.document.require('box').parent?.label()).toBe('g#markers');
    await cli.execute('tree');
    await cli.execute('show c1');
    await cli.execute('help');
    await cli.execute('redo');
    expect(workspace.document.find('box')).toBeNull();
  });

  it('in 子句、空文字、六种图形以及结构编辑均可通过命令行调用', async () => {
    const workspace = new Workspace();
    const cli = new CommandDispatcher(workspace);
    for (const line of [
      'init 400 300', 'create g root', 'create g nested in root',
      'create text t 1 2 "in" in nested', 'create rect r 1 2 3 4 in nested',
      'create circle c 1 2 3', 'create ellipse e 1 2 3 4', 'create line l 1 2 3 4 black',
      'addto root c', 'front nested', 'back nested', 'ungroup nested', 'undo', 'redo',
      'set t text ""', 'scale r 2',
    ]) await cli.execute(line);
    expect(workspace.document.require('t').textContent).toBe('');
    expect(workspace.document.require('r').getAttribute('width')).toBe('6');
    expect(workspace.document.require('r').parent?.label()).toBe('g#root');
    await cli.execute('undo');
    expect(workspace.document.require('r').getAttribute('width')).toBe('3');
    await cli.execute('move r 1 2');
    await expect(cli.execute('redo')).rejects.toThrow('nothing to redo');
  });

  it('保存及 canvas 修改才锁定历史，查询尺寸不锁定', async () => {
    const path = join(await directory(), 'my drawing.svg');
    const cli = new CommandDispatcher();
    await cli.execute('init');
    await cli.execute('create g scene');
    await cli.execute('canvas');
    await cli.execute('undo');
    await cli.execute('redo');
    await cli.execute(`save "${path}"`);
    await expect(cli.execute('undo')).rejects.toThrow('undo not allowed after io command');
    await expect(cli.execute('redo')).rejects.toThrow('undo not allowed after io command');
    await cli.execute('create g other');
    await cli.execute('undo');
    await cli.execute('canvas 400 300');
    await expect(cli.execute('redo')).rejects.toThrow('undo not allowed after io command');
    await cli.execute('save');
    expect(await readFile(path, 'utf8')).toContain('width="400"');
  });

  it('错误参数及 IO 失败保持文档、路径和 redo 历史', async () => {
    const workspace = new Workspace();
    const cli = new CommandDispatcher(workspace);
    await cli.execute('init');
    await cli.execute('create rect r 1 2 3 4');
    await cli.execute('move r 10 0');
    await cli.execute('undo');
    const original = workspace.document;
    const before = (await cli.execute('tree'))[0];
    const invalid = join(await directory(), 'invalid.svg');
    await writeFile(invalid, '<svg><g></svg>');
    for (const command of [
      'init 10 invalid', 'canvas 10', 'canvas 10 -1', 'canvas 10 NaN', 'save',
      `save "${invalid}/missing.svg"`, `read "${invalid}"`, `read "${invalid}/missing.svg"`,
      'create g', 'create rect r 0 0 1 1', 'create g g in missing', 'create g g in r',
      'create box b', 'group empty', 'group "" r', 'scale r 0', 'scale r Infinity',
      'move r NaN 0', 'set r width bad', 'set r nonsense 1', 'undo extra', 'help extra',
    ]) {
      await expect(cli.execute(command), command).rejects.toThrow();
      expect(workspace.document).toBe(original);
      expect((await cli.execute('tree'))[0]).toBe(before);
      expect(workspace.document.path).toBeNull();
    }
    await cli.execute('redo');
    expect(workspace.document.require('r').getAttribute('x')).toBe('11');
  });

  it('成功读入打印补名警告并替换文档、清空旧历史', async () => {
    const path = join(await directory(), 'external.svg');
    await writeFile(path, '<svg width="400" height="300"><rect/><circle id="c" r="3"/></svg>');
    const workspace = new Workspace();
    const cli = new CommandDispatcher(workspace);
    await cli.execute('init');
    await cli.execute('create g old');
    expect(await cli.execute(`read "${path}"`)).toEqual([
      'warning: assigned id rect1 to unnamed <rect>', `read ${path} (2 elements)`,
    ]);
    expect(workspace.document.find('old')).toBeNull();
    await expect(cli.execute('undo')).rejects.toThrow('undo not allowed after io command');
    await cli.execute('move c 1 2');
    await cli.execute('undo');
    await expect(cli.execute('undo')).rejects.toThrow('nothing to undo');
  });
});

describe('REPL 与真实进程', () => {
  it('逐行处理错误并继续，错误消息始终只有一行', async () => {
    const output = new PassThrough();
    let transcript = '';
    output.on('data', (chunk) => { transcript += chunk.toString(); });
    await new Repl(new CommandDispatcher(), Readable.from([
      '# comment\n\nhelp\ntree\ninit\ncreate text t 0 0 "ok"\nset t text "unterminated\nshow t\n',
    ]), output).run();
    expect(transcript).toContain("error: no document. use 'init' or 'read' first\n");
    expect(transcript).toContain('error: unterminated double quote\n');
    expect(transcript).toContain('text#t  parent=svg\n  x=0 y=0 text="ok"');
    expect(transcript).not.toContain('svg> ');
  });

  it('终端模式显示 svg> 提示符并在 EOF 结束', async () => {
    const output = new PassThrough();
    let transcript = '';
    output.on('data', (chunk) => { transcript += chunk.toString(); });
    await new Repl(new CommandDispatcher(), Readable.from(['init\n']), output, true).run();
    expect(transcript).toContain('svg> ');
    expect(transcript).toContain('canvas 800x600 created');
  });

  it('真实入口完成脚本回放，异步 save/read 严格按输入顺序执行', async () => {
    const path = join(await directory(), 'flow chart.svg');
    const input = [
      'init 800 600', 'create g flowchart', 'create g n1 in flowchart',
      'create rect start 120 100 160 60 #4a90d9 in n1',
      'create text label 155 135 "开始" in n1',
      `save "${path}"`, 'undo', 'init 10 10', `read "${path}"`,
      'move n1 0 100', 'undo', 'tree', 'save', '',
    ].join('\n');
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: join(import.meta.dirname, '../..'), input, encoding: 'utf8', timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`saved to ${path} (4 elements)`);
    expect(result.stdout).toContain('error: undo not allowed after io command');
    expect(result.stdout).toContain(`read ${path} (4 elements)`);
    expect(result.stdout).toContain('rect#start  x=120 y=100 w=160 h=60');
    const saved = await readFile(path, 'utf8');
    expect(saved).toContain('width="800"');
    expect(saved).toContain('>开始</text>');
  });
});
