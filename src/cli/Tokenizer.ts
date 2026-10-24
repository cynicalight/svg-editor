import { EditorError } from '../model/EditorError.js';
import { Token } from './Token.js';

export class Tokenizer {
  tokenize(line: string): Token[] {
    if (line.trimStart().startsWith('#')) return [];
    const tokens: Token[] = [];
    let index = 0;
    while (index < line.length) {
      if (/\s/.test(line[index])) { index++; continue; }
      const quoted = line[index] === '"';
      let value = '';
      if (quoted) {
        index++;
        let closed = false;
        while (index < line.length) {
          const character = line[index++];
          if (character === '"') { closed = true; break; }
          if (character === '\\' && (line[index] === '"' || line[index] === '\\')) {
            value += line[index++];
          } else value += character;
        }
        if (!closed) throw new EditorError('unterminated double quote');
        if (index < line.length && !/\s/.test(line[index])) {
          throw new EditorError('expected whitespace after closing quote');
        }
      } else {
        while (index < line.length && !/\s/.test(line[index])) {
          if (line[index] === '"') throw new EditorError('double quote must start a parameter');
          value += line[index++];
        }
      }
      tokens.push(new Token(value, quoted));
    }
    return tokens;
  }
}
