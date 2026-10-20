import type { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';
import { Placement } from './Placement.js';

/**
 * 新建容器并收编若干已有图形（各自从原父节点摘出，保持文档顺序）。
 * 新容器占据第一个成员原来的位置。整条命令是一个撤销单元。
 */
export class GroupCommand implements EditCommand {
  private readonly group: Group;
  private readonly members: Shape[];
  private readonly origins: Placement[];
  private readonly anchor: Placement;

  constructor(document: Document, groupId: string, memberIds: readonly string[]) {
    document.assertIdAvailable(groupId);
    const picked = new Set(memberIds.map((id) => document.require(id)));
    for (const container of picked) {
      for (const other of picked) {
        if (other !== container && container.contains(other)) {
          throw EditorError.containerIntoDescendant(container.id);
        }
      }
    }
    this.members = document.all().filter((shape) => picked.has(shape));
    this.origins = this.members.map((shape) => Placement.of(shape));
    this.anchor = this.origins[0];
    this.group = new Group(groupId);
  }

  execute(): string {
    this.anchor.parent.insert(this.group, this.anchor.index);
    for (const member of this.members) this.group.insert(member);
    return `${this.group.label()} created with ${this.members.length} children`;
  }

  undo(): string {
    this.anchor.parent.remove(this.group);
    Placement.restoreAll(this.origins);
    return `${this.group.label()} removed, ${this.members.length} children restored`;
  }
}
