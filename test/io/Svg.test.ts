import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Workspace } from '../../src/commands/Workspace.js';
import { Document } from '../../src/model/Document.js';
import { ShapeFactory } from '../../src/model/ShapeFactory.js';
import { SvgFileStore } from '../../src/io/SvgFileStore.js';
import { SvgParser } from '../../src/io/SvgParser.js';
import { SvgSerializer } from '../../src/io/SvgSerializer.js';

const parser = new SvgParser();
const serializer = new SvgSerializer();
const example = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;

describe('SVG 解析与序列化', () => {
  it('读入作业 other.svg 样例，补 id 并保留文档顺序', () => {
    const { document, warnings } = parser.parse(example);
    expect(document.canvas.width).toBe(400);
    expect(document.canvas.height).toBe(300);
    expect(document.count()).toBe(7);
    expect(document.all().map((shape) => shape.id)).toEqual(['rect1', 't1', 'c1', 'g1', 'r2', 'c2', 'e1']);
    expect(document.require('r2').parent).toBe(document.require('g1'));
    expect(warnings).toEqual(['warning: assigned id rect1 to unnamed <rect>']);
  });

  it('预留稍后出现的显式 id，并允许不同大小写', () => {
    const { document, warnings } = parser.parse('<svg><rect/><g><rect id="rect1"/><rect/><rect id="RECT1"/></g></svg>');
    expect(document.all().map((shape) => shape.id)).toEqual(['rect2', 'g1', 'rect1', 'rect3', 'RECT1']);
    expect(warnings).toHaveLength(3);
  });

  it('六种类型、嵌套、特殊字符和外观属性往返一致', () => {
    const { document } = parser.parse(example);
    const factory = new ShapeFactory();
    const group = document.requireContainer('g1');
    group.insert(factory.create('line', 'a&"b', ['-1.5', '2', '3', '4', 'black']));
    group.insert(factory.create('g', 'empty'));
    document.require('t1').setAttribute('text', '  中文 <&> "\n\t\r🙂  ');
    group.setAttribute('stroke-width', '2');
    group.setAttribute('fill', 'red');
    const output = serializer.serialize(document);
    expect(output).toContain('id="a&amp;&quot;b"');
    expect(output).toContain('中文 &lt;&amp;&gt;');
    const result = parser.parse(output);
    expect(result.warnings).toEqual([]);
    expect(serializer.serialize(result.document)).toBe(output);
    expect(result.document.require('t1').textContent).toBe(document.require('t1').textContent);
    expect(result.document.requireContainer('empty').children).toEqual([]);
  });

  it('保留文本中的 CDATA、实体和空内容；支持 SVG 命名空间前缀', () => {
    const { document } = parser.parse('<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:text id="t"><![CDATA[<&]]>&amp;&#20013;</s:text><s:text id="empty"/></s:svg>');
    expect(document.require('t').textContent).toBe('<&&中');
    expect(document.require('empty').textContent).toBe('');
  });

  it('缺少几何属性时使用 SVG 的零值默认；data-kind 容器降级为普通 g', () => {
    const { document } = parser.parse('<svg><g id="box" data-kind="box"><rect id="r"/></g></svg>');
    expect(document.require('box').type).toBe('g');
    expect(document.require('r').getAttribute('width')).toBe('0');
    expect(document.require('r').getAttribute('fill')).toBeUndefined();
  });

  it.each([
    ['<svg><rect id="a"/><g id="a"/></svg>', 'id already exists: a'],
    ['<svg><path id="p"/></svg>', 'unknown shape type: path'],
    ['<svg><rect x="oops"/></svg>', 'invalid number: oops'],
    ['<svg><rect transform="translate(1,2)"/></svg>', 'unknown attribute: transform'],
    ['<svg><rect onclick="alert(1)"/></svg>', 'unknown attribute: onclick'],
    ['<svg><text><rect/></text></svg>', 'unexpected child element'],
    ['<svg><g>hello</g></svg>', 'unexpected text'],
    ['<svg width="0"/>', 'canvas dimensions must be positive'],
    ['<svg width="400px"/>', 'invalid number'],
    ['<svg viewBox="10 0 800 600"/>', 'unsupported viewBox'],
    ['<svg style="fill:red"/>', 'unsupported svg attribute'],
    ['<other/>', 'expected <svg> root'],
    ['<svg xmlns="https://example.com"/>', 'unsupported namespace'],
    ['<svg><g></svg>', 'invalid SVG'],
    ['<svg/><svg/>', 'invalid SVG'],
    ['<svg><rect id="a" id="b"/></svg>', 'invalid SVG'],
    ['<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>', 'DOCTYPE is not supported'],
    ['<svg><text>&unknown;</text></svg>', 'invalid SVG'],
  ])('拒绝不支持或非法输入：%s', (source, message) => {
    expect(() => parser.parse(source)).toThrow(message);
  });

  it('失败后解析器可复用，当前工作区保持原文档', () => {
    const workspace = new Workspace();
    const original = new Document();
    workspace.open(original);
    expect(() => workspace.open(parser.parse('<svg><rect/><bad/></svg>').document)).toThrow();
    expect(workspace.document).toBe(original);
    expect(parser.parse('<svg/>').document.count()).toBe(0);
  });

  it('拒绝写出 XML 非法控制字符', () => {
    const document = new Document();
    document.canvas.insert(new ShapeFactory().create('text', 't', ['0', '0', '\u0000']));
    expect(() => serializer.serialize(document)).toThrow('invalid XML character');
  });
});

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('SVG 文件读写', () => {
  it('保存、读回、无参数覆盖原路径；无临时文件残留', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'svg-editor-'));
    directories.push(directory);
    const path = join(directory, 'drawing.svg');
    const store = new SvgFileStore();
    const { document } = parser.parse(example);
    expect(await store.save(document, path)).toBe(path);
    expect(document.path).toBe(path);
    const loaded = await store.read(path);
    expect(loaded.document.path).toBe(path);
    expect(loaded.document.count()).toBe(7);
    loaded.document.canvas.resize(500, 300);
    await store.save(loaded.document);
    expect((await readFile(path, 'utf8'))).toContain('width="500"');
    expect(await readdir(directory)).toEqual(['drawing.svg']);
  });

  it('读写错误使用规定文案，失败不更新路径，不破坏已有文件', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'svg-editor-'));
    directories.push(directory);
    const path = join(directory, 'drawing.svg');
    const absent = join(directory, 'absent', 'drawing.svg');
    const store = new SvgFileStore();
    const document = new Document();
    await expect(store.save(document)).rejects.toThrow('no file path');
    await expect(store.read(absent)).rejects.toThrow(`cannot read file: ${absent}`);
    document.path = path;
    await expect(store.save(document, absent)).rejects.toThrow(`cannot write file: ${absent}`);
    expect(document.path).toBe(path);
    await writeFile(path, 'keep this');
    document.canvas.insert(new ShapeFactory().create('text', 't', ['0', '0', '\u0000']));
    await expect(store.save(document)).rejects.toThrow('invalid XML character');
    expect(await readFile(path, 'utf8')).toBe('keep this');
    expect(await readdir(directory)).toEqual(['drawing.svg']);
  });
});
