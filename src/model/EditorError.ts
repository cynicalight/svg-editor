/**
 * 领域层的业务错误。message 即用户可见的文案（不含 "error: " 前缀，前缀由外壳统一加）。
 * 用静态工厂方法集中管理文案，保证与需求 4.2 的错误表一一对应。
 */
export class EditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorError';
  }

  static idExists(id: string): EditorError {
    return new EditorError(`id already exists: ${id}`);
  }

  static noSuchShape(id: string): EditorError {
    return new EditorError(`no such shape: ${id}`);
  }

  static noSuchContainer(id: string): EditorError {
    return new EditorError(`no such container: ${id}`);
  }

  static notAContainer(id: string): EditorError {
    return new EditorError(`not a container: ${id}`);
  }

  static unknownAttribute(attr: string): EditorError {
    return new EditorError(`unknown attribute: ${attr}`);
  }

  static invalidNumber(text: string): EditorError {
    return new EditorError(`invalid number: ${text}`);
  }

  static nonPositiveScale(): EditorError {
    return new EditorError('scale factor must be positive');
  }
}
