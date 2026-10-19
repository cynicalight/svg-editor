import type { Shape } from './Shape.js';

/**
 * 能容纳子图形的节点：<g> 容器与画布根 <svg>。
 * 画布不是 Shape（没有 id、不能被 move），但和 Group 一样是父节点，所以抽出这个接口。
 */
export interface Container {
  readonly children: readonly Shape[];

  /** 插入子图形；若它已有父节点，先从原父节点摘出。index 省略时追加到末尾。 */
  insert(shape: Shape, index?: number): void;

  /** 摘出子图形，返回它原来的位置。 */
  remove(shape: Shape): number;

  indexOf(shape: Shape): number;

  /** 用于显示，如 "g#markers" 或 "svg"。 */
  label(): string;

  /** 是否为画布根（svg 元素本身）。 */
  isRoot(): boolean;
}
