import { describe, expect, it } from 'vitest';
import { Circle } from '../../src/model/Circle.js';
import { Document } from '../../src/model/Document.js';
import { Group } from '../../src/model/Group.js';
import { Line } from '../../src/model/Line.js';
import { Rect } from '../../src/model/Rect.js';
import { Text } from '../../src/model/Text.js';

function rect(id: string, x: number, y: number, w: number, h: number): Rect {
  const r = new Rect(id);
  r.setAttribute('x', String(x));
  r.setAttribute('y', String(y));
  r.setAttribute('width', String(w));
  r.setAttribute('height', String(h));
  return r;
}

function circle(id: string, cx: number, cy: number, r: number): Circle {
  const c = new Circle(id);
  c.setAttribute('cx', String(cx));
  c.setAttribute('cy', String(cy));
  c.setAttribute('r', String(r));
  return c;
}

/** markers ⊃ { c1, inner ⊃ { r1 } } */
function sample(): { doc: Document; markers: Group; inner: Group; c1: Circle; r1: Rect } {
  const doc = new Document();
  const markers = new Group('markers');
  const inner = new Group('inner');
  const c1 = circle('c1', 100, 100, 20);
  const r1 = rect('r1', 0, 0, 10, 10);
  doc.canvas.insert(markers);
  markers.insert(c1);
  markers.insert(inner);
  inner.insert(r1);
  return { doc, markers, inner, c1, r1 };
}

describe('Composite: 容器与叶子统一操作', () => {
  it('move 容器时递归平移所有子孙', () => {
    const { markers, c1, r1 } = sample();
    markers.move(10, 5);
    expect(c1.getAttribute('cx')).toBe('110');
    expect(c1.getAttribute('cy')).toBe('105');
    expect(r1.getAttribute('x')).toBe('10');
    expect(r1.getAttribute('width')).toBe('10');
  });

  it('scale 同乘到全部几何属性（位置与尺寸）', () => {
    const { markers, c1, r1 } = sample();
    markers.scale(2);
    expect(c1.attributes()).toEqual([['cx', '200'], ['cy', '200'], ['r', '40']]);
    expect(r1.getAttribute('height')).toBe('20');
  });

  it('line 平移时两个端点都移动', () => {
    const line = new Line('l');
    line.setAttribute('x2', '10');
    line.move(1, 2);
    expect(line.attributes()).toEqual([['x1', '1'], ['y1', '2'], ['x2', '11'], ['y2', '2']]);
  });

  it('浮点噪声被格式化掉', () => {
    const r = rect('r', 0.1, 0, 1, 1);
    r.move(0.2, 0);
    expect(r.getAttribute('x')).toBe('0.3');
  });
});

describe('属性白名单', () => {
  it('外观属性对叶子与容器都可设置', () => {
    const { markers, c1 } = sample();
    c1.setAttribute('fill', 'red');
    markers.setAttribute('stroke', 'black');
    expect(c1.attributes()).toContainEqual(['fill', 'red']);
    expect(markers.attributes()).toEqual([['stroke', 'black']]);
  });

  it('白名单外的属性报错', () => {
    const { markers, c1 } = sample();
    expect(() => c1.setAttribute('x', '1')).toThrow('unknown attribute: x');
    expect(() => markers.setAttribute('x', '1')).toThrow('unknown attribute: x');
  });

  it('几何属性必须是数字', () => {
    expect(() => new Rect('r').setAttribute('x', 'abc')).toThrow('invalid number: abc');
  });

  it('text 的内容通过 text 属性读写，但不出现在 SVG 属性里', () => {
    const t = new Text('t1');
    t.setAttribute('text', 'My Diagram');
    expect(t.content).toBe('My Diagram');
    expect(t.attributes().map(([name]) => name)).toEqual(['x', 'y']);
  });
});

describe('树结构与 Document', () => {
  it('按 id 查找子孙，大小写敏感', () => {
    const { doc, r1 } = sample();
    expect(doc.find('r1')).toBe(r1);
    expect(doc.find('R1')).toBeNull();
    expect(() => doc.require('r9')).toThrow('no such shape: r9');
  });

  it('requireContainer 区分"不存在"与"不是容器"', () => {
    const { doc, inner } = sample();
    expect(doc.requireContainer('inner')).toBe(inner);
    expect(() => doc.requireContainer('node9')).toThrow('no such container: node9');
    expect(() => doc.requireContainer('c1')).toThrow('not a container: c1');
  });

  it('insert 到新父节点时自动从原父节点摘出，父指针保持一致', () => {
    const { doc, markers, c1 } = sample();
    doc.canvas.insert(c1, 0);
    expect(markers.children).not.toContain(c1);
    expect(doc.canvas.children[0]).toBe(c1);
    expect(c1.parent).toBe(doc.canvas);
  });

  it('contains 与 count 覆盖整棵子树', () => {
    const { doc, markers, inner, r1 } = sample();
    expect(markers.contains(r1)).toBe(true);
    expect(inner.contains(markers)).toBe(false);
    expect(doc.count()).toBe(4);
  });
});
