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
}
