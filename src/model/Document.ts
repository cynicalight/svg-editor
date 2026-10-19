import { Canvas } from './Canvas.js';
import { EditorError } from './EditorError.js';
import type { Group } from './Group.js';
import type { Shape } from './Shape.js';

/**
 * 当前编辑的文档：画布 + 图形树 + 关联的文件路径。
 * id 查找直接遍历树，不另建索引——树是唯一的事实来源，不存在"索引与树不同步"的问题。
 */
export class Document {
  readonly canvas: Canvas;

  constructor(canvas: Canvas = new Canvas(), private filePath: string | null = null) {
    this.canvas = canvas;
  }

  get path(): string | null {
    return this.filePath;
  }

  set path(value: string | null) {
    this.filePath = value;
  }

  find(id: string): Shape | null {
    for (const shape of this.canvas.children) {
      const found = shape.findById(id);
      if (found) return found;
    }
    return null;
  }

  require(id: string): Shape {
    const shape = this.find(id);
    if (!shape) throw EditorError.noSuchShape(id);
    return shape;
  }

  requireContainer(id: string): Group {
    const shape = this.find(id);
    if (!shape) throw EditorError.noSuchContainer(id);
    const group = shape.asGroup();
    if (!group) throw EditorError.notAContainer(id);
    return group;
  }

  assertIdAvailable(id: string): void {
    if (this.find(id)) throw EditorError.idExists(id);
  }

  count(): number {
    return this.canvas.children.reduce((sum, shape) => sum + shape.count(), 0);
  }
}
