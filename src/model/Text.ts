import { Geometry } from './Geometry.js';
import { LeafShape } from './LeafShape.js';
import { Memento } from './Memento.js';

/** 文字：位置是几何属性，内容是 SVG 子文本而非属性，但可通过 set <id> text 修改。 */
export class Text extends LeafShape {
  private static readonly CONTENT = 'text';

  protected readonly geometry = new Geometry([
    ['x', 'x'],
    ['y', 'y'],
  ]);
  private body = '';

  override get type(): string {
    return 'text';
  }

  get content(): string {
    return this.body;
  }

  protected override hasOwnAttribute(name: string): boolean {
    return name === Text.CONTENT || super.hasOwnAttribute(name);
  }

  protected override getOwnAttribute(name: string): string | undefined {
    return name === Text.CONTENT ? this.body : super.getOwnAttribute(name);
  }

  protected override setOwnAttribute(name: string, value: string): void {
    if (name === Text.CONTENT) {
      this.body = value;
    } else {
      super.setOwnAttribute(name, value);
    }
  }

  protected override snapshotOwn(): Memento {
    const body = this.body;
    return Memento.of([super.snapshotOwn(), new Memento(() => (this.body = body))]);
  }
}
