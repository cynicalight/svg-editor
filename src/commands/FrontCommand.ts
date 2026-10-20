import { ReorderCommand } from './ReorderCommand.js';

export class FrontCommand extends ReorderCommand {
  protected override targetIndex(): number {
    return Number.MAX_SAFE_INTEGER;
  }

  protected override verb(): string {
    return 'brought to front';
  }
}
