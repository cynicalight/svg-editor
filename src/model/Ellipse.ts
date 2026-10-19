import { Geometry } from './Geometry.js';
import { LeafShape } from './LeafShape.js';

export class Ellipse extends LeafShape {
  protected readonly geometry = new Geometry([
    ['cx', 'x'],
    ['cy', 'y'],
    ['rx', 'length'],
    ['ry', 'length'],
  ]);

  override get type(): string {
    return 'ellipse';
  }
}
