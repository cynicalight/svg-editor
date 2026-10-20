import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';
import { Placement } from './Placement.js';

/**
 * 调整同级 z-order 的公共骨架（Template Method）：子类只决定目标下标与措辞。
 * SVG 中越靠后的元素画在越上层。
 */
export abstract class ReorderCommand implements EditCommand {
  protected readonly shape: Shape;
  private readonly origin: Placement;

  constructor(document: Document, id: string) {
    this.shape = document.require(id);
    this.origin = Placement.of(this.shape);
  }

  execute(): string {
    this.origin.parent.insert(this.shape, this.targetIndex());
    return `${this.shape.label()} ${this.verb()}`;
  }

  undo(): string {
    this.origin.restore();
    return `${this.shape.label()} returned to position ${this.origin.index}`;
  }

  protected abstract targetIndex(): number;

  protected abstract verb(): string;
}
