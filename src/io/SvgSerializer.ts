import type { Document } from '../model/Document.js';
import { NumberFormat } from '../model/NumberFormat.js';
import type { Shape } from '../model/Shape.js';
import { XmlEscaper } from './XmlEscaper.js';

export class SvgSerializer {
  serialize(document: Document): string {
    const width = NumberFormat.format(document.canvas.width);
    const height = NumberFormat.format(document.canvas.height);
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      ...document.canvas.children.map((shape) => this.element(shape, 1)),
      '</svg>',
      '',
    ].join('\n');
  }

  private element(shape: Shape, depth: number): string {
    const indent = '  '.repeat(depth);
    const attributes = [['id', shape.id], ...shape.attributes()]
      .map(([name, value]) => `${name}="${XmlEscaper.attribute(value)}"`).join(' ');
    const start = `${indent}<${shape.type} ${attributes}`;
    if (shape.textContent !== null) {
      return `${start}>${XmlEscaper.text(shape.textContent).replaceAll('\r', '&#13;')}</${shape.type}>`;
    }
    const children = shape.asGroup()?.children ?? [];
    if (children.length === 0) return `${start}/>`;
    return `${start}>\n${children.map((child) => this.element(child, depth + 1)).join('\n')}\n${indent}</${shape.type}>`;
  }
}
