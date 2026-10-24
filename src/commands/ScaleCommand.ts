import type { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import type { Memento } from '../model/Memento.js';
import { NumberFormat } from '../model/NumberFormat.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';

/**
 * 等比缩放。撤销用 Memento 恢复快照，而非"再乘 1/factor"：
 * 浮点下 x * 3 / 3 不一定等于 x，反向运算会累积误差。
 */
export class ScaleCommand implements EditCommand {
  private readonly shape: Shape;
  private before: Memento | null = null;

  constructor(document: Document, id: string, private readonly factor: number) {
    if (!(factor > 0)) throw EditorError.nonPositiveScale();
    this.shape = document.require(id);
  }

  execute(): string {
    this.before = this.shape.snapshot();
    try {
      this.shape.scale(this.factor);
    } catch (error) {
      this.before.restore();
      throw error;
    }
    return `${this.shape.label()} scaled by ${NumberFormat.format(this.factor)}`;
  }

  undo(): string {
    this.before!.restore();
    return `${this.shape.label()} scale undone`;
  }
}
