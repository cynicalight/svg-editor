import { EditorError } from './EditorError.js';

/** 几何数值的解析与显示：浮点运算后去掉 0.30000000000000004 这类噪声。 */
export class NumberFormat {
  private static readonly PRECISION = 6;

  static parse(text: string): number {
    const value = Number(text);
    if (text.trim() === '' || !Number.isFinite(value)) {
      throw EditorError.invalidNumber(text);
    }
    return value;
  }

  static format(value: number): string {
    return String(Number(value.toFixed(NumberFormat.PRECISION)));
  }
}
