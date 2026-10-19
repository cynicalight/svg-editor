import { Geometry } from './Geometry.js';
import { LeafShape } from './LeafShape.js';

export class Circle extends LeafShape {
  protected readonly geometry = new Geometry([
    ['cx', 'x'],
    ['cy', 'y'],
    ['r', 'length'],
  ]);

  override get type(): string {
    return 'circle';
  }
}
