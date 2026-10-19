import { ChildList } from './ChildList.js';
import type { Container } from './Container.js';
import type { Shape } from './Shape.js';

/** 画布根 <svg>：持有尺寸与顶层图形。它是容器，但不是 Shape。 */
export class Canvas implements Container {
  static readonly DEFAULT_WIDTH = 800;
  static readonly DEFAULT_HEIGHT = 600;

  private readonly childList = new ChildList(this);

  constructor(
    private w: number = Canvas.DEFAULT_WIDTH,
    private h: number = Canvas.DEFAULT_HEIGHT,
  ) {}

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
  }

  get children(): readonly Shape[] {
    return this.childList.all;
  }

  insert(shape: Shape, index?: number): void {
    this.childList.insert(shape, index);
  }

  remove(shape: Shape): number {
    return this.childList.remove(shape);
  }

  indexOf(shape: Shape): number {
    return this.childList.indexOf(shape);
  }

  label(): string {
    return 'svg';
  }

  isRoot(): boolean {
    return true;
  }
}
