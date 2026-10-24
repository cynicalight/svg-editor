import { Geometry } from './Geometry.js';
import { LeafShape } from './LeafShape.js';

export class Rect extends LeafShape {
  protected readonly geometry = new Geometry([
    ['x', 'x'],
    ['y', 'y'],
    ['width', 'length'],
    ['height', 'length'],
  ]);

  override get type(): string {
    return 'rect';
  }

  override geometrySummary(): string {
    return `x=${this.getAttribute('x')} y=${this.getAttribute('y')} w=${this.getAttribute('width')} h=${this.getAttribute('height')}`;
  }
}
