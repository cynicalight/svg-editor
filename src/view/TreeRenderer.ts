import type { Document } from '../model/Document.js';
import { NumberFormat } from '../model/NumberFormat.js';
import { Paint } from '../model/Paint.js';
import type { Shape } from '../model/Shape.js';

export class TreeRenderer {
  render(document: Document, id?: string): string {
    if (id !== undefined) {
      const root = document.require(id);
      return [this.summary(root), ...this.children(root.asGroup()?.children ?? [], '')].join('\n');
    }
    return [
      `svg (${NumberFormat.format(document.canvas.width)}x${NumberFormat.format(document.canvas.height)})`,
      ...this.children(document.canvas.children, ''),
    ].join('\n');
  }

  private summary(shape: Shape): string {
    const paint = shape.attributes().filter(([name]) => (Paint.NAMES as readonly string[]).includes(name))
      .map(([name, value]) => `${name}=${value}`).join(' ');
    return [shape.label(), shape.geometrySummary(), paint].filter(Boolean).join('  ');
  }

  private children(shapes: readonly Shape[], prefix: string): string[] {
    return shapes.flatMap((shape, index) => {
      const last = index === shapes.length - 1;
      return [
        `${prefix}${last ? '└── ' : '├── '}${this.summary(shape)}`,
        ...this.children(shape.asGroup()?.children ?? [], prefix + (last ? '    ' : '│   ')),
      ];
    });
  }
}
