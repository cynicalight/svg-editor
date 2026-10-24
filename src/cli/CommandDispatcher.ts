import { AddToCommand } from '../commands/AddToCommand.js';
import { BackCommand } from '../commands/BackCommand.js';
import { CreateCommand } from '../commands/CreateCommand.js';
import { DeleteCommand } from '../commands/DeleteCommand.js';
import type { EditCommand } from '../commands/EditCommand.js';
import { FrontCommand } from '../commands/FrontCommand.js';
import { GroupCommand } from '../commands/GroupCommand.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { ScaleCommand } from '../commands/ScaleCommand.js';
import { SetCommand } from '../commands/SetCommand.js';
import { UngroupCommand } from '../commands/UngroupCommand.js';
import { Workspace } from '../commands/Workspace.js';
import { SvgFileStore } from '../io/SvgFileStore.js';
import { Canvas } from '../model/Canvas.js';
import type { Container } from '../model/Container.js';
import { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import { NumberFormat } from '../model/NumberFormat.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { ShowRenderer } from '../view/ShowRenderer.js';
import { TreeRenderer } from '../view/TreeRenderer.js';
import type { Token } from './Token.js';
import { Tokenizer } from './Tokenizer.js';

type Definition = {
  readonly syntax: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly needsDocument: boolean;
  readonly run: (args: string[], tokens: readonly Token[]) => string[] | Promise<string[]>;
};

/** 命令名分派的唯一入口；不直接修改图形，编辑操作交给 Command。 */
export class CommandDispatcher {
  private readonly definitions = new Map<string, Definition>();

  constructor(
    private readonly workspace = new Workspace(),
    private readonly files = new SvgFileStore(),
    private readonly factory = new ShapeFactory(),
    private readonly tokenizer = new Tokenizer(),
    private readonly tree = new TreeRenderer(),
    private readonly show = new ShowRenderer(),
  ) {
    this.register('init', 'init [w] [h]', 0, 2, false, (args) => {
      const width = this.dimension(args[0] ?? String(Canvas.DEFAULT_WIDTH));
      const height = this.dimension(args[1] ?? String(Canvas.DEFAULT_HEIGHT));
      this.workspace.open(new Document(new Canvas(width, height)));
      return [`canvas ${this.size()} created`];
    });
    this.register('read', 'read <file.svg>', 1, 1, false, async ([path]) => {
      const { document, warnings } = await this.files.read(path);
      this.workspace.open(document);
      return [...warnings, `read ${path} (${document.count()} elements)`];
    });
    this.register('save', 'save [file.svg]', 0, 1, true, async ([path]) => {
      const document = this.workspace.document;
      const saved = await this.files.save(document, path);
      this.workspace.history.lock();
      return [`saved to ${saved} (${document.count()} elements)`];
    });
    this.register('canvas', 'canvas [w h]', 0, 2, true, (args) => {
      if (args.length === 1) throw new EditorError('usage: canvas [w h]');
      if (args.length === 2) {
        const width = this.dimension(args[0]);
        const height = this.dimension(args[1]);
        this.workspace.document.canvas.resize(width, height);
        this.workspace.history.lock();
      }
      return [`canvas ${this.size()}`];
    });
    this.register('create', 'create <type> <id> [params…] [in <containerId>]', 2, Infinity, true,
      (_args, tokens) => this.create(tokens));
    this.edit('delete', 'delete <id>', 1, 1, ([id]) => new DeleteCommand(this.workspace.document, id));
    this.edit('move', 'move <id> <dx> <dy>', 3, 3,
      ([id, dx, dy]) => new MoveCommand(this.workspace.document, id, NumberFormat.parse(dx), NumberFormat.parse(dy)));
    this.edit('scale', 'scale <id> <factor>', 2, 2,
      ([id, factor]) => new ScaleCommand(this.workspace.document, id, NumberFormat.parse(factor)));
    this.edit('set', 'set <id> <attr> <value>', 3, 3,
      ([id, attribute, value]) => new SetCommand(this.workspace.document, id, attribute, value));
    this.edit('group', 'group <newGid> <id1> [id2…]', 2, Infinity, ([id, ...members]) => {
      if (id.trim() === '') throw EditorError.missingShapeId();
      return new GroupCommand(this.workspace.document, id, members);
    });
    this.edit('ungroup', 'ungroup <gid>', 1, 1, ([id]) => new UngroupCommand(this.workspace.document, id));
    this.edit('addto', 'addto <gid> <id>', 2, 2, ([gid, id]) => new AddToCommand(this.workspace.document, gid, id));
    this.edit('front', 'front <id>', 1, 1, ([id]) => new FrontCommand(this.workspace.document, id));
    this.edit('back', 'back <id>', 1, 1, ([id]) => new BackCommand(this.workspace.document, id));
    this.register('tree', 'tree [id]', 0, 1, true, ([id]) => [this.tree.render(this.workspace.document, id)]);
    this.register('show', 'show <id>', 1, 1, true, ([id]) => [this.show.render(this.workspace.document, id)]);
    this.register('help', 'help', 0, 0, false, () => this.help());
    this.register('undo', 'undo', 0, 0, true, () => [this.workspace.history.undo()]);
    this.register('redo', 'redo', 0, 0, true, () => [this.workspace.history.redo()]);
  }

  async execute(line: string): Promise<string[]> {
    const tokens = this.tokenizer.tokenize(line);
    if (tokens.length === 0) return [];
    const name = tokens[0].value;
    const definition = this.definitions.get(name);
    if (!definition) throw new EditorError(`unknown command: ${name}. use 'help' for commands`);
    if (definition.needsDocument) void this.workspace.document;
    const args = tokens.slice(1);
    if (args.length < definition.minimum || args.length > definition.maximum) {
      throw new EditorError(`usage: ${definition.syntax}`);
    }
    return definition.run(args.map((token) => token.value), args);
  }

  private create(tokens: readonly Token[]): string[] {
    const args = tokens.map((token) => token.value);
    const document = this.workspace.document;
    let container: Container = document.canvas;
    if (tokens.length >= 4 && tokens.at(-2)!.value === 'in' && !tokens.at(-2)!.quoted) {
      container = document.requireContainer(args.at(-1)!);
      args.splice(-2);
    }
    const [type, id, ...params] = args;
    const shape = this.factory.create(type, id, params);
    return [this.workspace.history.execute(new CreateCommand(document, shape, container))];
  }

  private dimension(value: string): number {
    const result = NumberFormat.parse(value);
    if (result <= 0) throw new EditorError('canvas dimensions must be positive');
    return result;
  }

  private size(): string {
    const canvas = this.workspace.document.canvas;
    return `${NumberFormat.format(canvas.width)}x${NumberFormat.format(canvas.height)}`;
  }

  private register(name: string, syntax: string, minimum: number, maximum: number,
    needsDocument: boolean, run: Definition['run']): void {
    this.definitions.set(name, { syntax, minimum, maximum, needsDocument, run });
  }

  private edit(name: string, syntax: string, minimum: number, maximum: number,
    build: (args: string[]) => EditCommand): void {
    this.register(name, syntax, minimum, maximum, true,
      (args) => [this.workspace.history.execute(build(args))]);
  }

  private help(): string[] {
    return [
      ...[...this.definitions.values()].map(({ syntax }) => syntax),
      '', 'Shape parameters (append in <containerId> to any create command):',
      '  create rect <id> <x> <y> <w> <h> [fill]',
      '  create circle <id> <cx> <cy> <r> [fill]',
      '  create ellipse <id> <cx> <cy> <rx> <ry> [fill]',
      '  create line <id> <x1> <y1> <x2> <y2> [stroke]',
      '  create text <id> <x> <y> "content"',
      '  create g <id>',
      '', 'Use double quotes for spaces; escape quotes with \\" and backslashes with \\\\.',
      'Lines beginning with # are comments. End input with Ctrl-D (Ctrl-C also exits).',
    ];
  }
}
