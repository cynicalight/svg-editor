import type { Document } from '../model/Document.js';
import type { Memento } from '../model/Memento.js';
import { NumberFormat } from '../model/NumberFormat.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';

/** 平移（增量）。对容器递归生效——由 Composite 负责，命令本身不区分。 */
export class MoveCommand implements EditCommand {
  private readonly shape: Shape;
  private before: Memento | null = null;

  constructor(
    document: Document,
    id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    this.shape = document.require(id);
  }

  execute(): string {
    this.before = this.shape.snapshot();
    try {
      this.shape.move(this.dx, this.dy);
    } catch (error) {
      this.before.restore();
      throw error;
    }
    return `${this.shape.label()} ${this.describe('moved to', this.dx, this.dy)}`;
  }

  undo(): string {
    this.before!.restore();
    return `${this.shape.label()} ${this.describe('moved back to', -this.dx, -this.dy)}`;
  }

  /** 叶子报告新位置；容器没有自身位置，报告位移量。 */
  private describe(verb: string, dx: number, dy: number): string {
    const anchor = this.shape.anchor();
    if (anchor) return `${verb} ${MoveCommand.point(...anchor)}`;
    return `${verb.replace(' to', '')} by ${MoveCommand.point(dx, dy)}`;
  }

  private static point(x: number, y: number): string {
    return `(${NumberFormat.format(x)},${NumberFormat.format(y)})`;
  }
}
