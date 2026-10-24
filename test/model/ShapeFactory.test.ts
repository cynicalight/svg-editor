import { describe, expect, it } from 'vitest';
import { CreateCommand } from '../../src/commands/CreateCommand.js';
import { Workspace } from '../../src/commands/Workspace.js';
import { Document } from '../../src/model/Document.js';
import { ShapeFactory } from '../../src/model/ShapeFactory.js';

const factory = new ShapeFactory();

describe('ShapeFactory', () => {
  it.each([
    ['rect', ['10', '20', '100', '50'], { x: '10', y: '20', width: '100', height: '50' }],
    ['circle', ['100', '100', '20'], { cx: '100', cy: '100', r: '20' }],
    ['ellipse', ['1', '2', '3', '4'], { cx: '1', cy: '2', rx: '3', ry: '4' }],
    ['line', ['-1.5', '2', '3', '4'], { x1: '-1.5', y1: '2', x2: '3', y2: '4' }],
    ['text', ['20', '40', 'My Diagram 中文'], { x: '20', y: '40' }],
    ['g', [], {}],
  ] as const)('创建 %s，保留几何属性且不填充默认外观', (type, params, attributes) => {
    const shape = factory.create(type, 'item', params);
    expect(shape.type).toBe(type);
    expect(shape.id).toBe('item');
    expect(shape.parent).toBeNull();
    expect(Object.fromEntries(shape.attributes())).toEqual(attributes);
  });

  it.each([
    ['rect', ['1', '2', '3', '4'], 'fill'],
    ['circle', ['1', '2', '3'], 'fill'],
    ['ellipse', ['1', '2', '3', '4'], 'fill'],
    ['line', ['1', '2', '3', '4'], 'stroke'],
  ] as const)('%s 的可选颜色设置到 %s', (type, params, attribute) => {
    expect(factory.create(type, 'item', [...params, '#4a90d9']).getAttribute(attribute)).toBe('#4a90d9');
  });

  it.each(['My Diagram 中文', '', 'in'])('文字内容原样保留：%s', (content) => {
    expect(factory.create('text', 't1', ['20', '40', content]).getAttribute('text')).toBe(content);
  });

  it.each(['box', 'hexagon', 'Rect', 'constructor', '__proto__'])('拒绝未知类型 %s', (type) => {
    expect(() => factory.create(type, 'item')).toThrow(`unknown shape type: ${type} (is the plugin loaded?)`);
  });

  it.each(['', '   '])('拒绝空 id', (id) => {
    expect(() => factory.create('g', id)).toThrow('shape id is required');
  });

  it.each([
    ['rect', ['1', '2', '3']],
    ['rect', ['1', '2', '3', '4', 'red', 'extra']],
    ['circle', []],
    ['ellipse', ['1', '2', '3']],
    ['line', ['1', '2', '3']],
    ['text', ['1', '2']],
    ['text', ['1', '2', 'hello', 'extra']],
    ['g', ['extra']],
  ])('拒绝 %s 的错误参数数量', (type, params) => {
    expect(() => factory.create(type, 'item', params)).toThrow(`invalid parameters for ${type}`);
  });

  it.each(['NaN', 'Infinity', '1px', ''])('拒绝非法几何数值 %s', (value) => {
    expect(() => factory.create('rect', 'r1', ['1', '2', '3', value])).toThrow('invalid number:');
  });

  it('接入 CreateCommand 后支持容器归属、撤销重做；失败不影响文档和历史', () => {
    const ws = new Workspace();
    const doc = new Document();
    ws.open(doc);
    ws.history.execute(new CreateCommand(doc, factory.create('g', 'scene'), doc.canvas));
    const group = doc.requireContainer('scene');
    const shape = factory.create('rect', 'r1', ['1', '2', '3', '4']);
    ws.history.execute(new CreateCommand(doc, shape, group));
    expect(group.children).toEqual([shape]);
    ws.history.undo();
    expect(doc.find('r1')).toBeNull();
    expect(() => factory.create('rect', 'bad', ['1', '2', '3', 'oops'])).toThrow();
    ws.history.redo();
    expect(group.children).toEqual([shape]);
    expect(() => new CreateCommand(doc, factory.create('g', 'r1'), group)).toThrow('id already exists: r1');
    expect(doc.count()).toBe(2);
    ws.history.undo();
    expect(group.children).toEqual([]);
  });
});
