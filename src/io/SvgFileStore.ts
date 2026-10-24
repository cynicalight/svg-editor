import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Document } from '../model/Document.js';
import { EditorError } from '../model/EditorError.js';
import { SvgParser } from './SvgParser.js';
import { SvgSerializer } from './SvgSerializer.js';

/** 文件成功读写后才更新路径；历史锁由外壳在成功返回后设置。 */
export class SvgFileStore {
  constructor(private readonly parser = new SvgParser(), private readonly serializer = new SvgSerializer()) {}

  async read(path: string): Promise<{ document: Document; warnings: string[] }> {
    let source: string;
    try {
      source = await readFile(path, 'utf8');
    } catch {
      throw new EditorError(`cannot read file: ${path}`);
    }
    const result = this.parser.parse(source);
    result.document.path = path;
    return result;
  }

  async save(document: Document, path = document.path): Promise<string> {
    if (!path) throw new EditorError('no file path. use save <file.svg>');
    const source = this.serializer.serialize(document);
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, source, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, path);
    } catch {
      throw new EditorError(`cannot write file: ${path}`);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    document.path = path;
    return path;
  }
}
