# SVG 编辑器（CLI）

高级软件开发 Lab1 Phase 1 作业：使用 TypeScript 和面向对象设计实现的命令行 SVG 编辑器。

**作业提交文档：[doc/README.md](doc/README.md)**，包含架构方案、设计模式、AI 协作过程、一致性自查和质量保证记录。

## 快速开始

使用 Node.js 24；项目提供 `.nvmrc`，安装了 nvm 时可先执行 `nvm use`。

```sh
npm ci
npm run cli
```

进入 `svg>` 提示符后，输入 `help` 查看命令。Ctrl-D 或 Ctrl-C 退出。

```text
init 800 600
create g scene
create rect r1 20 30 160 60 #4a90d9 in scene
create text t1 40 65 "Hello SVG" in scene
move scene 30 0
undo
tree
save demo.svg
```

保存后可用浏览器打开 `demo.svg`。

## 功能与范围

支持矩形、圆、椭圆、线、文字及分组，提供创建、删除、移动、缩放、属性修改、分组与解组、容器归属、层级排序、撤销重做，以及 SVG 文件读写和 `tree/show` 文本显示。

双引号用于带空格的参数；以 `#` 开头的整行是注释。成功执行 `init/read` 会替换文档并清空历史；成功保存或修改画布尺寸后，撤销重做锁定，直到下一条编辑命令执行。

SVG 读入限于本阶段的六种元素和属性白名单。`transform`、CSS、路径、字体属性及不匹配的 `viewBox` 会报错。`box` 插件不属于本阶段实现范围。详细边界见[提交文档](doc/README.md)。

## 示例

```sh
npm run cli < examples/flowchart.commands
```

该脚本在当前目录生成 `flowchart.svg`。仓库中也提供[示例 SVG](examples/flowchart.svg)和[命令脚本](examples/flowchart.commands)。

## 验证

```sh
npm test
npm run typecheck
npm run build
```

## 代码结构

| 目录 | 职责 |
|---|---|
| `src/model/` | 图形、容器、文档和图形工厂 |
| `src/commands/` | 编辑命令、撤销重做和工作区 |
| `src/io/` | SVG 解析、序列化和文件读写 |
| `src/view/` | `tree/show` 文本显示 |
| `src/cli/` | 分词、命令分发和交互循环 |
| `test/` | 模型、命令、IO、CLI 和架构测试 |
| `doc/` | 作业提交文档 |

最终交付版本由 [`final` 标签](https://github.com/cynicalight/svg-editor/tree/final)标记。
