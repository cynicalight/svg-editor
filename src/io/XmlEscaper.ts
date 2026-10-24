import { EditorError } from '../model/EditorError.js';

export class XmlEscaper {
  static text(value: string): string {
    if (/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(value)) {
      throw new EditorError('invalid XML character');
    }
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  static attribute(value: string): string {
    return this.text(value).replaceAll('"', '&quot;').replaceAll('\t', '&#9;')
      .replaceAll('\n', '&#10;').replaceAll('\r', '&#13;');
  }
}
