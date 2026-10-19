import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 依赖方向规则的自动检查（见 doc/README.md 1.3）。
 * key 模块只允许 import value 中列出的模块（自身目录始终允许）。
 */
const ALLOWED: Record<string, string[]> = {
  model: [],
  commands: ['model'],
  io: ['model'],
  view: ['model'],
  cli: ['model', 'commands', 'io', 'view'],
};

const SRC = join(import.meta.dirname, '..', 'src');
const IMPORT = /from\s+'(\.[^']+)'/g;

function importedModules(module: string): Array<{ file: string; target: string }> {
  let files: string[];
  try {
    files = readdirSync(join(SRC, module), { recursive: true, encoding: 'utf8' });
  } catch {
    return [];
  }
  return files
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => {
      const source = readFileSync(join(SRC, module, file), 'utf8');
      return [...source.matchAll(IMPORT)].map((match) => {
        const resolved = join(module, file, '..', match[1]);
        return { file: join(module, file), target: resolved.split('/')[0] };
      });
    });
}

describe('依赖方向', () => {
  for (const [module, allowed] of Object.entries(ALLOWED)) {
    it(`${module} 只依赖 [${allowed.join(', ') || '无'}]`, () => {
      const violations = importedModules(module)
        .filter(({ target }) => target !== module && !allowed.includes(target))
        .map(({ file, target }) => `${file} -> ${target}`);
      expect(violations).toEqual([]);
    });
  }

  it('model 不做 IO', () => {
    const offenders = readdirSync(join(SRC, 'model'))
      .filter((file) => /node:|console\./.test(readFileSync(join(SRC, 'model', file), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
