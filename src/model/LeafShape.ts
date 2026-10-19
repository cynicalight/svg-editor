import type { Geometry } from './Geometry.js';
import { NumberFormat } from './NumberFormat.js';
import { Shape } from './Shape.js';

/** Composite 中的叶子：自己持有几何属性，move/scale 直接作用于自身。 */
export abstract class LeafShape extends Shape {
  protected abstract readonly geometry: Geometry;

  override move(dx: number, dy: number): void {
    this.geometry.translate(dx, dy);
  }

  override scale(factor: number): void {
    this.geometry.scale(factor);
  }

  /** 按名读取几何数值，供视图层排版使用。 */
  coordinate(name: string): number {
    return this.geometry.get(name);
  }

  protected override hasOwnAttribute(name: string): boolean {
    return this.geometry.has(name);
  }

  protected override getOwnAttribute(name: string): string | undefined {
    return NumberFormat.format(this.geometry.get(name));
  }

  protected override setOwnAttribute(name: string, value: string): void {
    this.geometry.set(name, NumberFormat.parse(value));
  }

  protected override ownAttributes(): Array<[string, string]> {
    return this.geometry.names().map((name) => [name, NumberFormat.format(this.geometry.get(name))]);
  }
}
