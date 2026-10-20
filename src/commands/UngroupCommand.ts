import type { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import type { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';
import { Placement } from './Placement.js';

/** 解散容器：子图形提升到原容器的父级，依次占据原容器的位置。 */
export class UngroupCommand implements EditCommand {
  private readonly group: Group;
  private readonly origin: Placement;
  private readonly members: readonly Shape[];

  constructor(document: Document, id: string) {
    const shape = document.require(id);
    const group = shape.asGroup();
    if (!group) throw EditorError.notAContainer(id);
    if (group.parent!.isRoot()) throw EditorError.ungroupTopLevel(id);
    this.group = group;
    this.origin = Placement.of(group);
    this.members = [...group.children];
  }

  execute(): string {
    const { parent, index } = this.origin;
    parent.remove(this.group);
    this.members.forEach((member, offset) => parent.insert(member, index + offset));
    return `${this.group.label()} ungrouped (${this.members.length} children moved to ${parent.label()})`;
  }

  undo(): string {
    this.origin.restore();
    for (const member of this.members) this.group.insert(member);
    return `${this.group.label()} regrouped with ${this.members.length} children`;
  }
}
