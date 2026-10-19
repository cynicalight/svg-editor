import type { Container } from './Container.js';
import type { Shape } from './Shape.js';

/**
 * 有序子节点列表，Group 与 Canvas 共用（组合优于继承）。
 * 它是唯一维护 "子 → 父" 指针的地方，保证 children 与 parent 两个方向永远一致。
 */
export class ChildList {
  private readonly items: Shape[] = [];

  constructor(private readonly owner: Container) {}

  get all(): readonly Shape[] {
    return this.items;
  }

  insert(shape: Shape, index: number = this.items.length): void {
    shape.parent?.remove(shape);
    const at = Math.max(0, Math.min(index, this.items.length));
    this.items.splice(at, 0, shape);
    shape.attachTo(this.owner);
  }

  remove(shape: Shape): number {
    const index = this.items.indexOf(shape);
    if (index < 0) return -1;
    this.items.splice(index, 1);
    shape.attachTo(null);
    return index;
  }

  indexOf(shape: Shape): number {
    return this.items.indexOf(shape);
  }
}
