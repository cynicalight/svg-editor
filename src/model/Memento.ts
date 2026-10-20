/**
 * Memento 模式：保存某一时刻的内部状态，之后可原样恢复。
 * 状态本身被闭包封装，外部（命令、历史栈）只能 restore，无法窥视或篡改。
 */
export class Memento {
  constructor(private readonly restorer: () => void) {}

  restore(): void {
    this.restorer();
  }

  static of(parts: readonly Memento[]): Memento {
    return new Memento(() => {
      for (const part of parts) part.restore();
    });
  }
}
