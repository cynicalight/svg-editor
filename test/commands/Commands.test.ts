import { beforeEach, describe, expect, it } from 'vitest';
import { AddToCommand } from '../../src/commands/AddToCommand.js';
import { BackCommand } from '../../src/commands/BackCommand.js';
import { CreateCommand } from '../../src/commands/CreateCommand.js';
import { DeleteCommand } from '../../src/commands/DeleteCommand.js';
import { FrontCommand } from '../../src/commands/FrontCommand.js';
import { GroupCommand } from '../../src/commands/GroupCommand.js';
import { MoveCommand } from '../../src/commands/MoveCommand.js';
import { ScaleCommand } from '../../src/commands/ScaleCommand.js';
import { SetCommand } from '../../src/commands/SetCommand.js';
import { UngroupCommand } from '../../src/commands/UngroupCommand.js';
import { Workspace } from '../../src/commands/Workspace.js';
import { Circle } from '../../src/model/Circle.js';
import type { Container } from '../../src/model/Container.js';
import { Document } from '../../src/model/Document.js';
import { Group } from '../../src/model/Group.js';
import { Rect } from '../../src/model/Rect.js';
import type { Shape } from '../../src/model/Shape.js';
import { Text } from '../../src/model/Text.js';

/** 紧凑的结构描述：markers[c1,box] */
function outline(node: Container): string {
  return node.children
    .map((child: Shape) => {
      const group = child.asGroup();
      return group ? `${child.id}[${outline(group)}]` : child.id;
    })
    .join(',');
}

function shape<T extends Shape>(made: T, attrs: Record<string, string>): T {
  for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, value);
  return made;
}

let ws: Workspace;
let doc: Document;
const run = (build: (d: Document) => import('../../src/commands/EditCommand.js').EditCommand) =>
  ws.history.execute(build(doc));

beforeEach(() => {
  ws = new Workspace();
  ws.open(new Document());
  doc = ws.document;
  run((d) => new CreateCommand(d, shape(new Rect('bg'), { width: '800', height: '600', fill: '#ffffff' }), d.canvas));
  run((d) => new CreateCommand(d, shape(new Text('title'), { x: '20', y: '40', text: 'My Diagram' }), d.canvas));
  run((d) => new CreateCommand(d, shape(new Circle('c1'), { cx: '100', cy: '100', r: '20', fill: 'red' }), d.canvas));
  run((d) => new CreateCommand(d, shape(new Rect('box'), { x: '200', y: '80', width: '60', height: '60' }), d.canvas));
});

describe('典型会话（需求第 6 节）', () => {
  it('group / move / undo / redo / set / delete 的回显与状态', () => {
    expect(run((d) => new GroupCommand(d, 'markers', ['c1', 'box']))).toBe('g#markers created with 2 children');
    expect(outline(doc.canvas)).toBe('bg,title,markers[c1,box]');

    expect(run((d) => new MoveCommand(d, 'c1', 30, 0))).toBe('circle#c1 moved to (130,100)');
    expect(ws.history.undo()).toBe('circle#c1 moved back to (100,100)');
    expect(ws.history.redo()).toBe('circle#c1 moved to (130,100)');

    expect(run((d) => new SetCommand(d, 'title', 'text', 'My Diagram v2'))).toBe('text#title updated: text="My Diagram v2"');
    expect(ws.history.undo()).toBe('text#title updated: text="My Diagram"');

    expect(() => new GroupCommand(doc, 'bad', ['c1', 'markers'])).toThrow(
      'cannot group a container into its own descendant: markers',
    );
    expect(run((d) => new DeleteCommand(d, 'box'))).toBe('rect#box deleted');
    expect(ws.history.undo()).toBe('rect#box restored into g#markers');
    expect(outline(doc.canvas)).toBe('bg,title,markers[c1,box]');
  });

  it('容器移动报告位移量', () => {
    run((d) => new GroupCommand(d, 'node2', ['box']));
    expect(run((d) => new MoveCommand(d, 'node2', 0, 100))).toBe('g#node2 moved by (0,100)');
    expect(ws.history.undo()).toBe('g#node2 moved back by (0,-100)');
    expect(doc.require('box').getAttribute('y')).toBe('80');
  });
});

describe('undo/redo 规则', () => {
  it('undo 后的新编辑清空 redo 栈', () => {
    run((d) => new MoveCommand(d, 'c1', 1, 1));
    ws.history.undo();
    run((d) => new MoveCommand(d, 'c1', 2, 2));
    expect(() => ws.history.redo()).toThrow('nothing to redo');
  });

  it('IO 之后禁止 undo，下一条编辑命令解禁', () => {
    ws.history.lock();
    expect(() => ws.history.undo()).toThrow('undo not allowed after io command');
    run((d) => new MoveCommand(d, 'c1', 1, 1));
    expect(ws.history.undo()).toBe('circle#c1 moved back to (100,100)');
  });

  it('打开新文档后旧历史作废', () => {
    ws.open(new Document());
    expect(() => ws.history.undo()).toThrow('undo not allowed after io command');
  });

  it('没有文档时报错', () => {
    expect(() => new Workspace().document).toThrow("no document. use 'init' or 'read' first");
  });

  it('scale 撤销用快照，不累积浮点误差', () => {
    run((d) => new SetCommand(d, 'c1', 'r', '0.1'));
    run((d) => new ScaleCommand(d, 'c1', 3));
    ws.history.undo();
    expect(doc.require('c1').getAttribute('r')).toBe('0.1');
    expect(() => new ScaleCommand(doc, 'c1', 0)).toThrow('scale factor must be positive');
  });

  it('set 撤销能还原"未设置"状态', () => {
    run((d) => new SetCommand(d, 'box', 'fill', 'blue'));
    expect(ws.history.undo()).toBe('rect#box updated: fill=(unset)');
    expect(doc.require('box').attributes().map(([n]) => n)).not.toContain('fill');
  });
});

describe('结构类命令', () => {
  it('group 跨父节点收编，undo 一次全部复位', () => {
    run((d) => new GroupCommand(d, 'g1', ['c1']));
    run((d) => new GroupCommand(d, 'all', ['title', 'box', 'c1']));
    expect(outline(doc.canvas)).toBe('bg,all[title,c1,box],g1[]');
    ws.history.undo();
    expect(outline(doc.canvas)).toBe('bg,title,g1[c1],box');
  });

  it('create ... in 容器', () => {
    run((d) => new CreateCommand(d, new Group('node1'), d.canvas));
    const msg = run((d) => new CreateCommand(d, new Rect('start'), d.requireContainer('node1')));
    expect(msg).toBe('rect#start created in g#node1');
    expect(() => new CreateCommand(doc, new Rect('start'), doc.canvas)).toThrow('id already exists: start');
  });

  it('ungroup 提升子图形并占据原位置；顶层容器拒绝', () => {
    run((d) => new GroupCommand(d, 'outer', ['c1', 'box']));
    run((d) => new GroupCommand(d, 'inner', ['c1', 'box']));
    expect(() => new UngroupCommand(doc, 'outer')).toThrow('cannot ungroup top-level container: outer');
    run((d) => new UngroupCommand(d, 'inner'));
    expect(outline(doc.canvas)).toBe('bg,title,outer[c1,box]');
    ws.history.undo();
    expect(outline(doc.canvas)).toBe('bg,title,outer[inner[c1,box]]');
  });

  it('addto 不能把容器放进自己的子孙', () => {
    run((d) => new GroupCommand(d, 'g1', ['c1']));
    run((d) => new GroupCommand(d, 'g2', ['g1']));
    expect(() => new AddToCommand(doc, 'g1', 'g2')).toThrow('cannot group a container into its own descendant: g2');
    expect(run((d) => new AddToCommand(d, 'g1', 'box'))).toBe('rect#box added to g#g1');
    ws.history.undo();
    expect(outline(doc.canvas)).toBe('bg,title,g2[g1[c1]],box');
  });

  it('front / back 调整同级顺序并可撤销', () => {
    run((d) => new FrontCommand(d, 'bg'));
    expect(outline(doc.canvas)).toBe('title,c1,box,bg');
    run((d) => new BackCommand(d, 'box'));
    expect(outline(doc.canvas)).toBe('box,title,c1,bg');
    ws.history.undo();
    ws.history.undo();
    expect(outline(doc.canvas)).toBe('bg,title,c1,box');
  });
});
