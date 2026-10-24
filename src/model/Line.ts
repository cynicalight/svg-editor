import { Geometry } from './Geometry.js';
import { LeafShape } from './LeafShape.js';

export class Line extends LeafShape {
  protected readonly geometry = new Geometry([
    ['x1', 'x'],
    ['y1', 'y'],
    ['x2', 'x'],
    ['y2', 'y'],
  ]);

  override get type(): string {
    return 'line';
  }

  override geometrySummary(): string {
    return `(${this.getAttribute('x1')},${this.getAttribute('y1')}) -> (${this.getAttribute('x2')},${this.getAttribute('y2')})`;
  }
}
