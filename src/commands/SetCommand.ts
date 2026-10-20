import type { Document } from '../model/Document.js';
import type { Memento } from '../model/Memento.js';
import type { Shape } from '../model/Shape.js';
import type { EditCommand } from './EditCommand.js';

/** 设置一个属性。白名单校验由图形自己完成（多态），命令不维护属性表。 */
export class SetCommand implements EditCommand {
  private readonly shape: Shape;
  private before: Memento | null = null;

  constructor(
    document: Document,
    id: string,
    private readonly attr: string,
    private readonly value: string,
  ) {
    this.shape = document.require(id);
    this.shape.getAttribute(attr);
  }

  execute(): string {
    this.before = this.shape.snapshot();
    this.shape.setAttribute(this.attr, this.value);
    return this.summary();
  }

  undo(): string {
    this.before!.restore();
    return this.summary();
  }

  private summary(): string {
    const value = this.shape.getAttribute(this.attr);
    const shown = value === undefined ? '(unset)' : `"${value}"`;
    return `${this.shape.label()} updated: ${this.attr}=${shown}`;
  }
}
