import { EditorError } from './EditorError.js';

/** 几何属性在平移时随哪个方向变化；length 类（宽高、半径）平移时不变。 */
export type Axis = 'x' | 'y' | 'length';

/**
 * 一个图形的全部几何属性（有序、按名访问）。
 * 叶子图形只需声明"有哪些属性、各属于哪个轴"，平移/缩放的算法集中在这里，
 * 避免每个子类各写一遍 x += dx。
 */
export class Geometry {
  private readonly axes = new Map<string, Axis>();
  private readonly values = new Map<string, number>();

  constructor(spec: ReadonlyArray<readonly [string, Axis]>) {
    for (const [name, axis] of spec) {
      this.axes.set(name, axis);
      this.values.set(name, 0);
    }
  }

  has(name: string): boolean {
    return this.axes.has(name);
  }

  names(): string[] {
    return [...this.axes.keys()];
  }

  get(name: string): number {
    const value = this.values.get(name);
    if (value === undefined) throw EditorError.unknownAttribute(name);
    return value;
  }

  set(name: string, value: number): void {
    if (!this.has(name)) throw EditorError.unknownAttribute(name);
    this.values.set(name, value);
  }

  translate(dx: number, dy: number): void {
    for (const [name, axis] of this.axes) {
      const delta = axis === 'x' ? dx : axis === 'y' ? dy : 0;
      this.values.set(name, this.get(name) + delta);
    }
  }

  scale(factor: number): void {
    for (const name of this.axes.keys()) {
      this.values.set(name, this.get(name) * factor);
    }
  }
}
