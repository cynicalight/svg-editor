import type { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import { CommandHistory } from './CommandHistory.js';

/** 一次编辑会话的状态：当前文档（可能还没有）与它的命令历史。与输入通道无关。 */
export class Workspace {
  readonly history = new CommandHistory();
  private current: Document | null = null;

  get document(): Document {
    if (!this.current) throw EditorError.noDocument();
    return this.current;
  }

  /** init / read 时切换到新文档，旧历史作废。 */
  open(document: Document): void {
    this.current = document;
    this.history.reset();
  }
}
