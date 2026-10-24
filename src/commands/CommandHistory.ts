import { EditorError } from '../model/EditorError.js';
import type { EditCommand } from './EditCommand.js';

/**
 * undo/redo 的两个栈。一条编辑命令 = 一个撤销单元。
 * IO 类命令（save / canvas 等）之后上锁，直到下一条编辑命令解锁。
 */
export class CommandHistory {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private locked = false;

  execute(command: EditCommand): string {
    const summary = command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.locked = false;
    return summary;
  }

  undo(): string {
    const command = this.peek(this.undoStack, EditorError.nothingToUndo());
    const summary = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return summary;
  }

  redo(): string {
    const command = this.peek(this.redoStack, EditorError.nothingToRedo());
    const summary = command.execute();
    this.redoStack.pop();
    this.undoStack.push(command);
    return summary;
  }

  /** IO 命令执行后调用：在下一条编辑命令之前禁止 undo/redo。 */
  lock(): void {
    this.locked = true;
  }

  /** 换了一份文档：旧命令引用的是旧文档的对象，必须全部丢弃。 */
  reset(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lock();
  }

  private peek(stack: EditCommand[], whenEmpty: EditorError): EditCommand {
    if (this.locked) throw EditorError.undoLocked();
    const command = stack.at(-1);
    if (!command) throw whenEmpty;
    return command;
  }
}
