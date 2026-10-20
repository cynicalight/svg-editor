import { ReorderCommand } from './ReorderCommand.js';

export class BackCommand extends ReorderCommand {
  protected override targetIndex(): number {
    return 0;
  }

  protected override verb(): string {
    return 'sent to back';
  }
}
