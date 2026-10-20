import type { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import type { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';
import { Placement } from './Placement.js';

/** 把已有图形移入容器，作为最后一个子节点。 */
export class AddToCommand implements EditCommand {
  private readonly group: Group;
  private readonly shape: Shape;
  private readonly origin: Placement;

  constructor(document: Document, groupId: string, id: string) {
    this.group = document.requireContainer(groupId);
    this.shape = document.require(id);
    if (this.shape.contains(this.group)) throw EditorError.containerIntoDescendant(id);
    this.origin = Placement.of(this.shape);
  }

  execute(): string {
    this.group.insert(this.shape);
    return `${this.shape.label()} added to ${this.group.label()}`;
  }

  undo(): string {
    this.origin.restore();
    return `${this.shape.label()} moved back to ${this.origin.parent.label()}`;
  }
}
