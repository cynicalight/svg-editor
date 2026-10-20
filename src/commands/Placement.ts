import type { Container } from '../model/Container.js';
import type { Shape } from '../model/Shape.js';

/** 图形在树中的位置记录：哪个父节点、第几个。结构类命令撤销时据此放回原处。 */
export class Placement {
  private constructor(
    readonly shape: Shape,
    readonly parent: Container,
    readonly index: number,
  ) {}

  static of(shape: Shape): Placement {
    const parent = shape.parent!;
    return new Placement(shape, parent, parent.indexOf(shape));
  }

  restore(): void {
    this.parent.insert(this.shape, this.index);
  }

  /**
   * 按原下标从小到大逐个放回：插入第 i 位时，原本排在它前面的兄弟都已就位，下标即准确。
   */
  static restoreAll(placements: readonly Placement[]): void {
    [...placements].sort((a, b) => a.index - b.index).forEach((p) => p.restore());
  }
}
