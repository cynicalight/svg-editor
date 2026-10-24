import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { CommandDispatcher } from './CommandDispatcher.js';

export class Repl {
  constructor(
    private readonly dispatcher: CommandDispatcher,
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly terminal = false,
  ) {}

  async run(): Promise<void> {
    const reader = createInterface({ input: this.input, output: this.output, terminal: this.terminal });
    let closed = false;
    reader.on('close', () => { closed = true; });
    reader.on('SIGINT', () => reader.close());
    this.output.write("svg-editor 0.1 — type 'help' for commands\n");
    reader.setPrompt('svg> ');
    if (this.terminal) reader.prompt();
    try {
      for await (const line of reader) {
        try {
          const messages = await this.dispatcher.execute(line);
          for (const message of messages) this.output.write(`${message}\n`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.output.write(`error: ${message.replace(/[\r\n]+/g, ' ')}\n`);
        }
        if (this.terminal && !closed) reader.prompt();
      }
    } finally {
      reader.close();
    }
  }
}
