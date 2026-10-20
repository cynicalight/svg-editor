import type { Container } from '../model/Container.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';

/** 把一个已构造好的图形挂到容器下。图形由工厂按类型名构造，本命令不关心具体类型。 */
export class CreateCommand implements EditCommand {
  constructor(
    document: Document,
    private readonly shape: Shape,
    private readonly container: Container,
  ) {
    for (const each of shape.flatten()) document.assertIdAvailable(each.id);
  }

  execute(): string {
    this.container.insert(this.shape);
    const where = this.container.isRoot() ? '' : ` in ${this.container.label()}`;
    return `${this.shape.label()} created${where}`;
  }

  undo(): string {
    this.container.remove(this.shape);
    return `${this.shape.label()} removed`;
  }
}
