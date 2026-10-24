import { describe, expect, it } from 'vitest';
import { SvgParser } from '../../src/io/SvgParser.js';
import { TreeRenderer } from '../../src/view/TreeRenderer.js';
import { ShowRenderer } from '../../src/view/ShowRenderer.js';

const source = `<svg><rect id="bg" width="800" height="600" fill="#ffffff"/>
<text id="title" x="20" y="40">My Diagram</text>
<g id="markers"><circle id="c1" cx="100" cy="100" r="20" fill="red"/>
<g id="inner"><rect id="box" x="200" y="80" width="60" height="60" fill="#3366ff"/></g>
<line id="edge" x1="1" y1="2" x2="3" y2="4" stroke="black"/></g></svg>`;

describe('tree / show', () => {
  it('结构树包含尺寸、几何、文字、颜色及正确的嵌套连接线', () => {
    const { document } = new SvgParser().parse(source);
    expect(new TreeRenderer().render(document)).toBe([
      'svg (800x600)',
      '├── rect#bg  x=0 y=0 w=800 h=600  fill=#ffffff',
      '├── text#title  (20,40) "My Diagram"',
      '└── g#markers',
      '    ├── circle#c1  cx=100 cy=100 r=20  fill=red',
      '    ├── g#inner',
      '    │   └── rect#box  x=200 y=80 w=60 h=60  fill=#3366ff',
      '    └── line#edge  (1,2) -> (3,4)  stroke=black',
    ].join('\n'));
  });

  it('指定 id 只显示子树；支持叶子、空文档与缺失 id 错误', () => {
    const { document } = new SvgParser().parse(source);
    const renderer = new TreeRenderer();
    expect(renderer.render(document, 'inner')).toBe('g#inner\n└── rect#box  x=200 y=80 w=60 h=60  fill=#3366ff');
    expect(renderer.render(document, 'title')).toBe('text#title  (20,40) "My Diagram"');
    expect(renderer.render(new SvgParser().parse('<svg/>').document)).toBe('svg (800x600)');
    expect(() => renderer.render(document, 'absent')).toThrow('no such shape: absent');
  });

  it('show 展示父容器、完整属性名和文本；渲染不改变模型', () => {
    const { document } = new SvgParser().parse(source);
    const renderer = new ShowRenderer();
    const before = document.all().map((shape) => shape.attributes());
    expect(renderer.render(document, 'c1')).toBe('circle#c1  parent=g#markers\n  cx=100 cy=100 r=20\n  fill=red');
    expect(renderer.render(document, 'title')).toBe('text#title  parent=svg\n  x=20 y=40 text="My Diagram"');
    expect(renderer.render(document, 'markers')).toBe('g#markers  parent=svg');
    expect(renderer.render(document, 'box')).toContain('width=60 height=60');
    expect(() => renderer.render(document, 'absent')).toThrow('no such shape: absent');
    expect(document.all().map((shape) => shape.attributes())).toEqual(before);
  });
});
