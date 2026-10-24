import type { Container } from './Container.js';
import { EditorError } from './EditorError.js';
import type { Group } from './Group.js';
import { Memento } from './Memento.js';
import { Paint } from './Paint.js';

/**
 * Composite 模式中的抽象构件：叶子图形与 <g> 容器的共同父类。
 * 调用方只面向 Shape 编程，从不判断"它是不是容器"。
 */
export abstract class Shape {
  private parentNode: Container | null = null;
  protected readonly paint = new Paint();

  constructor(readonly id: string) {}

  /** SVG 标签名，同时也是 create 命令中的类型名，如 "rect"。 */
  abstract get type(): string;

  abstract move(dx: number, dy: number): void;

  abstract scale(factor: number): void;

  get parent(): Container | null {
    return this.parentNode;
  }

  /** 仅供 ChildList 维护父指针，其它代码不应调用。 */
  attachTo(parent: Container | null): void {
    this.parentNode = parent;
  }

  label(): string {
    return `${this.type}#${this.id}`;
  }

  /** 非文字图形没有子文本；序列化与视图无需按类型分派。 */
  get textContent(): string | null {
    return null;
  }

  geometrySummary(): string {
    return this.ownAttributes().map(([name, value]) => `${name}=${value}`).join(' ');
  }

  setAttribute(name: string, value: string): void {
    if (this.paint.has(name)) {
      this.paint.set(name, value);
    } else if (this.hasOwnAttribute(name)) {
      this.setOwnAttribute(name, value);
    } else {
      throw EditorError.unknownAttribute(name);
    }
  }

  /** 未设置的外观属性返回 undefined；白名单外的属性抛错。 */
  getAttribute(name: string): string | undefined {
    if (this.paint.has(name)) return this.paint.get(name);
    if (this.hasOwnAttribute(name)) return this.getOwnAttribute(name);
    throw EditorError.unknownAttribute(name);
  }

  /** 需写入 SVG 的属性：自身属性在前、外观属性在后（不含 id）。 */
  attributes(): Array<[string, string]> {
    return [...this.ownAttributes(), ...this.paint.entries()];
  }

  /** 图形的位置（叶子），容器没有自身位置时返回 null。 */
  anchor(): [number, number] | null {
    return null;
  }

  /** 保存以自身为根的子树的全部属性（不含树结构），用于撤销。 */
  snapshot(): Memento {
    return Memento.of([this.paint.snapshot(), this.snapshotOwn()]);
  }

  /** 以自身为根的子树，先序遍历（即文档顺序）。 */
  flatten(): Shape[] {
    return [this];
  }

  /** 安全式 Composite：只有容器返回自身，叶子返回 null。 */
  asGroup(): Group | null {
    return null;
  }

  findById(id: string): Shape | null {
    return this.id === id ? this : null;
  }

  /** other 是否为自身或自身的子孙。 */
  contains(other: Shape): boolean {
    return this === other;
  }

  /** 以自身为根的子树中的元素个数。 */
  count(): number {
    return 1;
  }

  protected abstract hasOwnAttribute(name: string): boolean;

  protected abstract getOwnAttribute(name: string): string | undefined;

  protected abstract setOwnAttribute(name: string, value: string): void;

  protected abstract ownAttributes(): Array<[string, string]>;

  protected abstract snapshotOwn(): Memento;
}
