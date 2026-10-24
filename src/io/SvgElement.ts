/** XML 解析阶段的临时节点，不暴露给领域层。 */
export class SvgElement {
  readonly children: SvgElement[] = [];
  private body = '';

  constructor(readonly name: string, readonly attributes: ReadonlyMap<string, string>) {}

  appendText(text: string): void {
    this.body += text;
  }

  get text(): string {
    return this.body;
  }

  flatten(): SvgElement[] {
    return [this, ...this.children.flatMap((child) => child.flatten())];
  }
}
