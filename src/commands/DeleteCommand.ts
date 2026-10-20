import type { Container } from '../model/Container.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';

/** 删除图形（容器连同全部子孙）。撤销时把同一个对象放回原父节点的原位置。 */
export class DeleteCommand implements EditCommand {
  private readonly shape: Shape;
  private readonly parent: Container;
  private readonly index: number;

  constructor(document: Document, id: string) {
    this.shape = document.require(id);
    this.parent = this.shape.parent!;
    this.index = this.parent.indexOf(this.shape);
  }

  execute(): string {
    this.parent.remove(this.shape);
    return `${this.shape.label()} deleted`;
  }

  undo(): string {
    this.parent.insert(this.shape, this.index);
    return `${this.shape.label()} restored into ${this.parent.label()}`;
  }
}
