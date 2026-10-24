import { Circle } from './Circle.js';
import { EditorError } from './EditorError.js';
import { Ellipse } from './Ellipse.js';
import { Group } from './Group.js';
import { Line } from './Line.js';
import { Rect } from './Rect.js';
import type { Shape } from './Shape.js';
import { Text } from './Text.js';

type ShapeDefinition = {
  readonly constructor: new (id: string) => Shape;
  readonly required: readonly string[];
  readonly optional?: string;
};

/** 类型名分派的唯一入口；后续插件阶段再替换为 ShapeProvider 注册。 */
export class ShapeFactory {
  private readonly definitions = new Map<string, ShapeDefinition>([
    ['rect', { constructor: Rect, required: ['x', 'y', 'width', 'height'], optional: 'fill' }],
    ['circle', { constructor: Circle, required: ['cx', 'cy', 'r'], optional: 'fill' }],
    ['ellipse', { constructor: Ellipse, required: ['cx', 'cy', 'rx', 'ry'], optional: 'fill' }],
    ['line', { constructor: Line, required: ['x1', 'y1', 'x2', 'y2'], optional: 'stroke' }],
    ['text', { constructor: Text, required: ['x', 'y', 'text'] }],
    ['g', { constructor: Group, required: [] }],
  ]);

  /** XML 属性式入口与 CLI 位置参数式入口共用类型表。缺省几何值沿用模型的 0。 */
  fromAttributes(type: string, id: string, attributes: ReadonlyMap<string, string>, text = ''): Shape {
    const definition = this.definitions.get(type);
    if (!definition) throw EditorError.unknownShapeType(type);
    if (id.trim() === '') throw EditorError.missingShapeId();
    const shape = new definition.constructor(id);
    for (const [name, value] of attributes) shape.setAttribute(name, value);
    if (shape.textContent !== null) shape.setAttribute('text', text);
    else if (text.trim() !== '') throw new EditorError(`unexpected text in <${type}>`);
    return shape;
  }

  /** 参数已由外壳分词并去除 in 子句；返回未挂入文档的图形。 */
  create(type: string, id: string, params: readonly string[] = []): Shape {
    const definition = this.definitions.get(type);
    if (!definition) throw EditorError.unknownShapeType(type);
    if (id.trim() === '') throw EditorError.missingShapeId();

    const minimum = definition.required.length;
    const maximum = minimum + (definition.optional ? 1 : 0);
    if (params.length < minimum || params.length > maximum) {
      throw EditorError.invalidShapeParameters(type, minimum, maximum);
    }

    const shape = new definition.constructor(id);
    definition.required.forEach((attribute, index) => {
      shape.setAttribute(attribute, params[index]);
    });
    if (definition.optional && params.length > minimum) {
      shape.setAttribute(definition.optional, params[minimum]);
    }
    return shape;
  }
}
