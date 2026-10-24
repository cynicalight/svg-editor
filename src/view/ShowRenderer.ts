import type { Document } from '../model/Document.js';
import { Paint } from '../model/Paint.js';

export class ShowRenderer {
  render(document: Document, id: string): string {
    const shape = document.require(id);
    const geometry: string[] = [];
    const paint: string[] = [];
    for (const [name, value] of shape.attributes()) {
      ((Paint.NAMES as readonly string[]).includes(name) ? paint : geometry).push(`${name}=${value}`);
    }
    if (shape.textContent !== null) geometry.push(`text=${JSON.stringify(shape.textContent)}`);
    return [
      `${shape.label()}  parent=${shape.parent?.label() ?? 'none'}`,
      ...[geometry, paint].filter((values) => values.length > 0).map((values) => `  ${values.join(' ')}`),
    ].join('\n');
  }
}
