import { Memento } from './Memento.js';

/**
 * 所有图形（含容器）共有的外观属性。未设置的属性不写入 SVG，遵循渲染默认值。
 */
export class Paint {
  static readonly NAMES = ['fill', 'stroke', 'stroke-width'] as const;

  private readonly values = new Map<string, string>();

  has(name: string): boolean {
    return (Paint.NAMES as readonly string[]).includes(name);
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  set(name: string, value: string): void {
    this.values.set(name, value);
  }

  snapshot(): Memento {
    const saved = new Map(this.values);
    return new Memento(() => {
      this.values.clear();
      for (const [name, value] of saved) this.values.set(name, value);
    });
  }

  /** 已设置的属性，按 NAMES 的固定顺序输出。 */
  entries(): Array<[string, string]> {
    return Paint.NAMES.flatMap((name) => {
      const value = this.values.get(name);
      return value === undefined ? [] : [[name, value] as [string, string]];
    });
  }
}
