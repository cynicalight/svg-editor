import { SaxesParser } from 'saxes';
import { Canvas } from '../model/Canvas.js';
import { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import { NumberFormat } from '../model/NumberFormat.js';
import type { Shape } from '../model/Shape.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { SvgElement } from './SvgElement.js';

export class SvgParser {
  constructor(private readonly factory = new ShapeFactory()) {}

  parse(source: string): { document: Document; warnings: string[] } {
    const root = this.xml(source);
    if (root.name !== 'svg') throw new EditorError('expected <svg> root');
    for (const name of root.attributes.keys()) {
      if (!['width', 'height', 'viewBox', 'id'].includes(name)) {
        throw new EditorError(`unsupported svg attribute: ${name}`);
      }
    }
    if (root.text.trim()) throw new EditorError('unexpected text in <svg>');
    const width = NumberFormat.parse(root.attributes.get('width') ?? String(Canvas.DEFAULT_WIDTH));
    const height = NumberFormat.parse(root.attributes.get('height') ?? String(Canvas.DEFAULT_HEIGHT));
    if (width <= 0 || height <= 0) throw new EditorError('canvas dimensions must be positive');
    const viewBox = root.attributes.get('viewBox');
    if (viewBox !== undefined) {
      const bounds = viewBox.trim().split(/[\s,]+/).map(NumberFormat.parse);
      if (bounds.length !== 4 || bounds.some((value, i) => value !== [0, 0, width, height][i])) {
        throw new EditorError('unsupported viewBox: expected 0 0 width height');
      }
    }

    const reserved = new Set<string>();
    for (const element of root.flatten()) {
      const id = element.attributes.get('id');
      if (id === undefined || id.trim() === '') continue;
      if (reserved.has(id)) throw EditorError.idExists(id);
      reserved.add(id);
    }
    const warnings: string[] = [];
    const document = new Document(new Canvas(width, height));
    for (const element of root.children) document.canvas.insert(this.shape(element, reserved, warnings));
    return { document, warnings };
  }

  private xml(source: string): SvgElement {
    const parser = new SaxesParser({ xmlns: true });
    const stack: SvgElement[] = [];
    const roots: SvgElement[] = [];
    parser.on('doctype', () => { throw new EditorError('DOCTYPE is not supported'); });
    parser.on('processinginstruction', () => { throw new EditorError('XML processing instructions are not supported'); });
    parser.on('error', (error) => { throw new EditorError(`invalid SVG: ${error.message.replace(/\s+/g, ' ')}`); });
    parser.on('opentag', (tag) => {
      if (tag.uri !== '' && tag.uri !== 'http://www.w3.org/2000/svg') {
        throw new EditorError(`unsupported namespace: ${tag.uri}`);
      }
      const attributes = new Map<string, string>();
      for (const attribute of Object.values(tag.attributes)) {
        if (attribute.uri === 'http://www.w3.org/2000/xmlns/') continue;
        if (attribute.uri !== '') throw new EditorError(`unsupported attribute: ${attribute.name}`);
        attributes.set(attribute.local, attribute.value);
      }
      const element = new SvgElement(tag.local, attributes);
      const parent = stack.at(-1);
      if (parent) parent.children.push(element);
      else roots.push(element);
      stack.push(element);
    });
    parser.on('text', (text) => stack.at(-1)?.appendText(text));
    parser.on('cdata', (text) => stack.at(-1)?.appendText(text));
    parser.on('closetag', () => { stack.pop(); });
    parser.write(source).close();
    if (roots.length !== 1) throw new EditorError('expected one <svg> root');
    return roots[0];
  }

  private shape(element: SvgElement, reserved: Set<string>, warnings: string[]): Shape {
    let id = element.attributes.get('id');
    if (id === undefined || id.trim() === '') {
      let sequence = 1;
      while (reserved.has(`${element.name}${sequence}`)) sequence++;
      id = `${element.name}${sequence}`;
      reserved.add(id);
      warnings.push(`warning: assigned id ${id} to unnamed <${element.name}>`);
    }
    const attributes = new Map(element.attributes);
    attributes.delete('id');
    const kind = attributes.get('data-kind');
    attributes.delete('data-kind');
    const shape = this.factory.fromAttributes(element.name, id, attributes, element.text);
    const group = shape.asGroup();
    if (kind !== undefined && !group) throw new EditorError('data-kind requires a container');
    if (group) {
      for (const child of element.children) group.insert(this.shape(child, reserved, warnings));
    } else if (element.children.length > 0) {
      throw new EditorError(`unexpected child element in <${element.name}>`);
    }
    return shape;
  }
}
