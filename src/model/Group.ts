import { ChildList } from './ChildList.js';
import type { Container } from './Container.js';
import { Memento } from './Memento.js';
import { Shape } from './Shape.js';

/**
 * Composite 中的组合节点：本身也是 Shape，操作一律转发给子节点。
 * 因此 Group 里可以再放 Group，嵌套任意层。
 */
export class Group extends Shape implements Container {
  private readonly childList = new ChildList(this);

  override get type(): string {
    return 'g';
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

  isRoot(): boolean {
    return false;
  }

  override move(dx: number, dy: number): void {
    for (const child of this.children) child.move(dx, dy);
  }

  override scale(factor: number): void {
    for (const child of this.children) child.scale(factor);
  }

  override asGroup(): Group {
    return this;
  }

  override findById(id: string): Shape | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }

  override flatten(): Shape[] {
    return [this, ...this.children.flatMap((child) => child.flatten())];
  }

  override contains(other: Shape): boolean {
    return this === other || this.children.some((child) => child.contains(other));
  }

  override count(): number {
    return this.children.reduce((sum, child) => sum + child.count(), 1);
  }

  // 容器没有几何属性，只接受外观属性（fill/stroke 会被子图形继承）。
  protected override hasOwnAttribute(): boolean {
    return false;
  }

  protected override getOwnAttribute(): string | undefined {
    return undefined;
  }

  protected override setOwnAttribute(): void {}

  protected override ownAttributes(): Array<[string, string]> {
    return [];
  }

  protected override snapshotOwn(): Memento {
    return Memento.of(this.children.map((child) => child.snapshot()));
  }
}
