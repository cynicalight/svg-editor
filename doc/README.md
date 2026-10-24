# SVG 编辑器（CLI）— 设计文档

## 运行与手动验收

建议使用 Node.js 24（现有 Vitest 5 支持的版本），在项目根目录执行：

```sh
npm ci
npm run cli
```

交互终端显示 `svg> `；输入 `help` 查看所有命令。Ctrl-D 或 Ctrl-C 退出。也可回放示例：

```sh
npm run cli < examples/flowchart.commands
```

示例在当前目录生成 `flowchart.svg`，可用浏览器手动打开。仓库也提供同一脚本生成的 [预览文件](../examples/flowchart.svg)。核对两个节点及中文标签，并确认第二个节点已下移 100 px、标签变为“处理数据 v2”。这是人工检查步骤，尚未代替用户完成浏览器视觉验收。

双引号包住含空格的内容或路径；引号内支持 `\\` 和 `\"` 转义，其余反斜线原样保留。只将整行开头的 `#` 视为注释，颜色值 `#ffffff` 可直接输入。管道输入不显示提示符，命令严格按顺序完成后再读下一条。空白行和注释不产生输出；一条命令失败后会显示 `error:` 并继续。

`init` 默认 800×600，只给宽度时高度仍为 600；`canvas` 无参数显示尺寸，修改时必须同时给宽高。成功 read/init 会替换文档并清空历史；成功 save 或修改 canvas 会锁定 undo/redo，直到下一次编辑。显示操作和失败命令不改变历史。

## 1. 架构方案

### 1.1 模块划分

| 模块 | 目录 | 职责 |
|---|---|---|
| 领域模型 | `src/model/` | 图形类层次（叶子图形 + 容器 `g`）、`Document`（画布尺寸、图形树、id 遍历查找）、图形工厂。纯逻辑，**不做任何 IO** |
| 编辑命令 | `src/commands/` | 每条可撤销的编辑操作是一个 Command 对象；`CommandHistory` 管理 undo/redo 栈与"IO 后禁止 undo"规则 |
| 序列化 | `src/io/` | `Document` ↔ SVG 文本的转换；文件读写；读入时自动补 id 并产生警告 |
| 视图 | `src/view/` | `tree` / `show` 的文本渲染（只读访问 model） |
| 命令行 | `src/cli/` | 分词（含双引号参数）、命令名 → 处理器的分发、REPL 循环、`error:` 输出格式 |
| 组装 | `src/main.ts` | 唯一的组装点（composition root）：创建各模块对象并接线 |

```plantuml
@startuml
package "cli" {
  [Repl]
  [Tokenizer]
  [CommandDispatcher]
}
package "commands" {
  [EditCommand]
  [CommandHistory]
}
package "io" {
  [SvgSerializer]
  [SvgParser]
  [SvgFileStore]
}
package "view" {
  [TreeRenderer]
  [ShowRenderer]
}
package "model" {
  [Shape]
  [Document]
  [ShapeFactory]
}
[CommandDispatcher] --> [EditCommand]
[Repl] --> [CommandDispatcher]
[CommandDispatcher] --> [SvgFileStore]
[CommandDispatcher] --> [ShowRenderer]
[CommandDispatcher] --> [TreeRenderer]
[EditCommand] --> [Document]
[SvgSerializer] --> [Document]
[SvgParser] --> [ShapeFactory]
[SvgFileStore] --> [SvgParser]
[SvgFileStore] --> [SvgSerializer]
[ShowRenderer] --> [Shape]
[TreeRenderer] --> [Shape]
@enduml
```

### 1.2 设计模式的选择

| 模式 | 解决的问题 | 落地位置 |
|---|---|---|
| **Command** | 编辑操作需要 undo/redo，且"一条命令 = 一个撤销单元" | `commands/`：每个编辑命令实现 `execute()` / `undo()`，`CommandHistory` 维护两个栈 |
| **Composite** | `move` / `scale` / `set` / `delete` 对 `<g>` 与叶子一视同仁 | `model/`：`Shape` 抽象基类，`Group` 持有子 `Shape` 并把操作递归转发 |
| **Factory（注册表）** | 类型名 → 图形类（`create rect …`、读入 `<rect>`） | `model/ShapeFactory`。⚠️ 按名字分派之一，**待重构**为插件注册（ShapeProvider） |
| 命令注册表 | 命令名 → 实现 | `cli/CommandDispatcher`。⚠️ 按名字分派之二，**待重构** |

补充模式：`Shape.snapshot()` 返回 Memento，保存几何、文字和外观，用于精确恢复；`ReorderCommand` 使用 Template Method，统一记录位置和撤销，FrontCommand/BackCommand 只决定目标位置与反馈文案。

### 1.3 依赖方向规则

```
cli ──► commands ──► model
cli ──► io ────────► model
cli ──► view ──────► model
```

- `model` **不依赖任何模块**：它最稳定，换掉任何外壳（CLI → Web）都不应波及它。`model` 中出现 `node:fs`、`console`、或对其它模块的 import 即为违规。
- `commands` 只依赖 `model`：命令不知道自己由谁触发（CLI / Web / agent）。
- `io`、`view` 只依赖 `model`：它们是领域对象与文本之间的翻译层，彼此互不依赖。
- `cli` 处于最外层，可依赖以上所有模块；**任何模块都不得依赖 `cli`**。
- 理由：依赖只能从易变一侧指向稳定一侧。

### 1.4 变化点假设

| 变化点 | 可能性 | 预留措施 / 不预留的理由 |
|---|---|---|
| 新的输入通道（Web 鼠标、AI agent） | 高（需求已明示三种通道） | 编辑语义全部在 `commands` + `model`，外壳只负责把输入翻译成 Command |
| 新图形类型（如 `box` 插件） | 高（4.4 已定义） | 本阶段工厂用注册表实现，新增类型只需注册；完整 ShapeProvider 插槽**本阶段不做**，避免过度设计 |
| 新的编辑命令 | 中 | 命令是独立类，新增命令不改已有命令；分发表需加一行（已标注待重构） |
| 输出格式（如导出 PNG / JSON） | 低 | 序列化集中在 `io/`，model 不感知格式；不额外抽象出格式接口 |

## 2. 过程记录

### 第 1–3 步：分层、Composite 与模型约束

初期将模型、编辑命令、SVG IO、文本视图和 CLI 分开，并约定依赖向模型方向流动。讨论“将来增加 Web 前端需要改哪里”时，学生指出模型和命令可以复用；进一步明确应新增与 CLI 平级的输入模块，避免为替换终端输出修改模型。后续加入架构测试，用导入关系检查这条约定。

Composite 的实现让 Group 与叶子均继承 Shape，Group 将 move/scale 递归交给子节点。Canvas 与 Group 共用 ChildList，但 Canvas 不继承 Group，因为画布没有图形 id，也不参与普通移动。几何属性封装在 Geometry 中，类型差异以属性及坐标轴声明表达，避免在各操作中重复判断图形类型。

ChildList 统一维护 parent 与 children 的一致性。Document 按树遍历查找 id，不另外维护索引，因此文档初稿中的“id 索引”在实现后修正为“遍历查找”。这种方案查找为 O(n)，适合当前小型命令行文档；若规模增长，应先测量再增加索引。

### 第 4 步：撤销方案与 Command

讨论中将“反向执行几何运算来撤销”的方案调整为 Memento 快照。原因是浮点乘除可能产生舍入差异，例如 `0.1 * 3 / 3` 不能精确恢复初值。MoveCommand、ScaleCommand 和 SetCommand 保存属性快照；结构编辑记录父节点与原下标，撤销分组时按原位置恢复成员。测试覆盖浮点缩放恢复和跨父节点分组撤销。

Workspace 管理当前文档及 CommandHistory。init/read 换文档时清空旧历史；save/canvas 修改只锁定撤销，下一次编辑解锁。命令返回纯文本摘要，这是当前对展示层的简化；如需多语言或结构化 API，再改为结果对象。讲解过程还出现过复述题未说明 CLI 是否已完成的问题，学生指出后补充前提，避免将规划中的模块误当作已实现功能。

### 第 5 步：图形工厂

`ShapeFactory.create(type, id, params)` 使用内置类型表创建六种图形。表中只保存构造器、必填属性顺序和可选颜色属性；数值校验复用图形的 `setAttribute`，避免另写一套几何解析规则。未知类型使用需求规定的错误文案，参数缺失或多余均拒绝。

工厂只返回未加入文档的对象。CLI 负责分词和剥离 `in` 子句；`CreateCommand` 负责文档内 id 唯一性检查与插入，历史栈负责撤销重做。创建失败不会向文档插入部分初始化的图形。完整插件注册接口留到后续阶段。

第 6 步已新增 `fromAttributes` 属性式入口，SVG 读入与 CLI 创建共用同一类型表。

### 第 6 步：SVG 与文本视图

`SvgParser` 使用 [saxes](https://github.com/lddubeau/saxes) 处理 XML 语法、实体、命名空间和结构错误。该依赖版本锁定为 6.0.0（上游已归档）；本项目不加载 DTD 或外部实体。解析先构造临时 XML 树并收集所有显式 id，再生成缺失 id，最后构造独立 Document。重复 id 或非法输入导致整次解析失败，调用方仅在成功后切换工作区。

`SvgSerializer` 递归访问属性、子节点和 `textContent`，负责 XML 转义。`SvgFileStore` 负责文件系统，成功读写后才更新路径；保存使用同目录临时文件和 rename，失败时清理临时文件。历史栈与 IO 相互独立，CLI 在成功保存后锁定历史，在成功读入后调用 Workspace.open。

`TreeRenderer` 和 `ShowRenderer` 只读模型。这里选择多态方法而未引入 Visitor：`textContent` 提供文字，`geometrySummary` 提供简短几何描述；视图负责连接线、缩进和分行。模型保留少量纯文本表示，避免在视图中按图形类型分派。如果未来需要多种输出风格，再评估 Visitor 的维护成本。

支持边界：六种内置元素、几何与外观白名单、文字、嵌套 g、缺失 id 自动补名、data-kind 容器降级。画布尺寸使用正数 px 数值（不带单位），缺省为 800×600；viewBox 仅接受与画布相同的 `0 0 width height`。本轮没有实现通用 SVG 导入：transform、CSS、字体属性、路径、非匹配 viewBox 等会报错，不会静默丢弃。作业背景中的带 transform 示例尚不支持，后续若要求导入这一示例，需要补充变换及文字尺寸的保留方案。

### 第 7 步：CLI 与脚本回放

`Tokenizer` 只负责分词并保留参数是否带引号，以区分文字中的 `"in"` 与 create 的尾部容器子句。整行注释不会误吞颜色值，未闭合引号报错。`CommandDispatcher` 使用一张命令注册表，同时管理语法、参数数量、是否要求当前文档以及处理函数；编辑处理函数创建已有 Command 并交给历史栈。

`Repl` 使用 Node readline 逐行读取，以 await 串行执行，包括异步文件操作。它统一输出错误并继续下一行，终端显示提示符，脚本输入无提示符。main.ts 负责组装。测试发现 EOF 可能先于最后一条命令完成，此时再次 prompt 会抛出 readline was closed；修正为监听 close 状态，仅在终端尚未关闭时显示下一次提示符。

### 第 8 步：最终本地验收

逐项检查发现数值输入合法不代表运算结果合法：`create rect r 1e308 0 1 1` 后执行 `scale r 2`，原实现报告成功并产生 Infinity。现改为 Geometry 先检查整组待写入数值，MoveCommand/ScaleCommand 在子树操作失败时恢复快照。历史栈也改为执行 undo/redo 成功后才移除原栈顶，失败可以重试。新增测试验证容器内前一个成员已被修改、后一个成员溢出时，所有成员和 redo 状态都恢复。

这一发现修正了早期“构造时校验后 execute 必然成功”的假设：目标和参数可以预先检查，运算结果及 IO 仍可能在执行时失败，需要明确的恢复机制。

### 修订记录

| 日期 | 修订内容 | 原因 |
|---|---|---|
| 2026-10-19 | 初版架构方案 | — |
| 2026-10-24 | 实现 ShapeFactory；将 id 索引描述修正为遍历查找 | 与现有模型保持一致，明确工厂与命令的责任边界 |
| 2026-10-24 | 实现 SVG IO、tree/show 与属性式工厂入口 | 复用模型多态，明确外部 SVG 支持边界 |
| 2026-10-24 | 接通 CLI、脚本回放与帮助；修复 EOF 后 prompt 错误 | 完成终端操作链路并以真实子进程验证 |
| 2026-10-24 | 修复几何运算溢出与失败时的历史栈处理，补齐过程和验收记录 | 满足失败命令不改变状态的约定 |

## 3. 一致性自查

截至本轮验收，model、commands、io、view、cli 均已实现，main.ts 已接通各层。新增 SvgFileStore、SvgElement、XmlEscaper 已归入 io；新增 ShowRenderer 已归入 view。架构依赖测试通过，model 不引用 IO，io/view 不引用 commands/cli。CLI 注册表是方案允许的命令名分派，图形类型分派仍集中在 ShapeFactory；最终提交前还需人工预览及交付检查。

## 4. 质量保证手段

截至本轮验收，112 个测试通过（使用 Node 24 运行 Vitest），`npm run typecheck` 通过。工厂测试覆盖六种类型、浮点与负坐标、可选颜色、含空格及空字符串的文字、未知类型、空 id、参数数量与非法数字。集成测试验证工厂产物进入容器后的撤销重做，以及创建失败不改变文档或破坏 redo 历史。

SVG 测试覆盖需求第 6 节的 other.svg、自动 id 与显式 id 冲突、六种元素往返、XML 转义与文字空白、非法 XML、重复 id、未知属性、文件保存与失败保护。视图测试核对 tree 连接线、子树、show 属性和渲染不修改模型。

CLI 测试覆盖分词、全部命令的调用、参数错误、缺少文档、IO 成败与历史状态、EOF 和终端提示符。真实 Node 子进程回放包含 save/read 的流程，验证异步顺序和落盘 SVG。类型检查及构建通过。浏览器人工预览和最终提交检查仍待完成。


### 需求核对表

| 原需求 | 实现与验证依据 | 结果 |
|---|---|---|
| 第 1 节：分步 Git 提交 | 脚手架、模型、命令、工厂、IO、CLI 分步提交；`git log --oneline` 可检查 | 本地记录具备；最终远程交付待完成 |
| 第 1 节：doc/README.md 四类内容 | 本文架构方案、过程记录、一致性自查、质量保证 | 已补齐 |
| 第 2 节：面向对象与依赖规则 | 类与文件对应；模型无 IO；类型分派集中于工厂，命令分派集中于 CLI | 自动架构检查通过 |
| 第 2 节：提示符、注释、引号、错误 | Tokenizer、Repl、CLI 测试 | 自动检查通过 |
| 第 3–4 节：六类图形与全部命令 | model/commands 测试及 CLI 调用验证；示例脚本回放 | 自动检查通过 |
| 第 4.2 节：id、容器、循环归属及无文档错误 | 模型、命令、工厂和 CLI 失败用例 | 自动检查通过 |
| 第 4.3 节：撤销重做与 IO 边界 | history 测试、失败原子性回归、真实进程 save/read | 自动检查通过 |
| 第 5 节：tree/show | 完整树、子树、父级、属性、文字与空文档测试 | 自动检查通过 |
| 第 6 节：示例 SVG 与会话 | other.svg 的 7 元素解析、缺 id 警告；典型编辑会话与 8 元素流程图脚本 | 自动检查通过 |
| SVG 浏览器显示 | examples/flowchart.svg，核对两个节点、中文与右侧下移 | 待人工确认 |
| 最终远程提交及 final 标签 | 对照实际提交哈希与远程标签 | 待完成；尚未标记最终交付 |

`box` 属后续插件阶段，本轮不实现。复合 box 的专属 ungroup 错误也不属于当前普通 g 的验收范围。外部 SVG 支持范围见第 6 步记录；带 transform 或 CSS 的文件会明确报错。这是已知兼容性限制，不能据此声称支持任意外部 SVG。

复验命令（Node 24）：

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run cli < examples/flowchart.commands
```

自动检查结果记录于 2026-10-24。浏览器显示、课程截止时间及课程平台提交入口尚未核实；测试通过不替代这些交付步骤。
