# Lab1 Phase 2 实验报告

在 Phase 1 CLI SVG 编辑器上完成插件式重构，并实现独立的 VSCode 扩展。原有六种图形与编辑、撤销、读写语义保留；新增 stats、dir、box、modified-star 四个插件包。

## 1. 构建与运行

仓库地址：[wujing-h/svg_editor_cli](https://github.com/wujing-h/svg_editor_cli)。完整实现与交付附件位于 **main** 分支；**demo/config-plugins** 分支用于证明仅通过配置接入四个新插件。

使用以下 CMD 命令获取主线代码：

```cmd
git clone --branch main https://github.com/wujing-h/svg_editor_cli.git
cd svg_editor_cli
```

下文附件链接以仓库内的 doc/README.md 为基准，可在克隆后阅读，或打开[仓库中的报告](https://github.com/wujing-h/svg_editor_cli/blob/main/doc/README.md)。

验证环境：Node.js 24.14.0、npm 11.9.0、TypeScript 7.0.2。以下为项目根目录 CMD 命令；首次使用先安装根项目及四个独立包的依赖：

```cmd
npm install
for %P in (plugin-stats plugin-dir plugin-shape-box plugin-tree-star) do npm --prefix plugins\%P install
npm run build
```

启动 CLI：

```cmd
npm run cli
```

该命令会先构建再启动编辑器。出现 `svg>` 提示符后即可输入 `help`、`init 800 600` 等命令。代码装配与配置装配的启动命令见[第 4 节](#4-两种装配与配置契约)。

VSCode 扩展要求 VSCode ≥1.100：用 VSCode **打开 extensions/vscode-svg 文件夹**，终端执行 `npm install`，按 F5 构建并启动 Extension Development Host；在新窗口中用文本编辑器打开 fixtures/example.svg，查看 Explorer 标记和原生 Outline。F5 同时启动调试宿主，`npm run build` 只编译。

## 2. 架构变化与设计模式

重构前，CommandDispatcher 的 switch 构造内置命令，ShapeFactory 枚举六种图形；新增类型或命令需要修改已有分派代码。重构后，组合根装配内置能力和可选插件，内核只查询接口与注册表。

```text
Phase 1：main → CLI → Dispatcher / Session → Shape / SvgDocument
                            └→ 内置命令、固定 ShapeFactory

Phase 2：main → bootstrap → CLI / PluginHost / 基础设施
                    ├→ builtins（六种图形、原有命令）
                    └→ plugins（stats、dir、box、star）→ plugin-api
         CLI → application → domain；内核不导入可选插件
```

PlantUML 依赖图源码：[重构前](architecture/before.puml)、[重构后](architecture/after.puml)。上面的文本结构可直接在 Markdown 中阅读。

| 需求 | 设计模式 / 原则 | 实现 |
| --- | --- | --- |
| 命令可扩展、执行和历史统一 | Command、注册表 | CommandDefinition 构造命令；CommandRegistry 查表，EditorSession 统一执行 |
| 容器与叶子统一移动、缩放 | Composite、Provider 工厂 | Shape / GroupShape；ShapeFactory 委托 ShapeProvider，box 继承容器行为 |
| 属性具有领域语义且可撤销 | Strategy、局部 Memento | BoxAttributes 选择语义；AttributeTransaction / AttributeChange 记录实际字段变化 |
| 同一树行组合多个标签 | Decorator、Observer | DecoratedTreeLineRenderer 包装 TreeLineRenderer；ModifiedStar 订阅成功会话事件 |
| dir 脱离具体文件系统 | Adapter、依赖倒置 | 客户端 DirCommand → 目标接口 DirectoryReader → NodeDirectoryAdapter → Node readdir/cwd |
| 新插件接入时保持内核稳定 | OCP、组合根 | EditorBootstrap 决定装配，PluginLoader 通用加载，PluginHost 校验和注册 |

dir 显示当前工作目录的直接子项，包含隐藏项；按目录、文件、链接、其他项分组，再按字符串升序排列。不递归、不跟随链接；控制字符转义。命令不依赖 SVG，不改变 cwd、文档或历史；测试替身和真实文件系统使用同一 DirectoryReader 接口。

## 3. 四个扩展点

插件公开入口为 [src/plugin-api/index.ts](../src/plugin-api/index.ts)，不依赖 bootstrap 或其他插件。接口与实际调用位置如下。

| 扩展点及定义 | 调用位置（文件 / 方法） | 本项目实现 | 未加载与违规处理 |
| --- | --- | --- | --- |
| [ShapeProvider](../src/domain/ShapeProvider.ts) | domain/ShapeFactory.ts：create、createFromParameters、createFromSvg | BuiltinShapeProvider、BoxProvider | 未知类型报错；未识别 data-kind 按原生标签降级；非法返回值、子树或复合结构拒绝创建/读取 |
| [CommandDefinition](../src/application/contracts/CommandDefinition.ts)、[Command](../src/application/contracts/Command.ts) | application/CommandRegistry.ts：create；CommandDispatcher.ts：dispatch → EditorSession.execute | 内置命令、StatsCommand、DirCommand | 未加载的命令不出现在 help，执行报 unknown command；非法命令对象拒绝执行；失败不记成功历史 |
| [TreeDecorator](../src/application/contracts/TreeDecorator.ts) | cli/CliFormatter.ts：createTreeRenderer；DecoratedTreeLineRenderer.ts：render | BoxTypeLabel、ModifiedStar | 空链保留原输出；抛错或返回非法后缀时报告并隔离该实例，保留基础行及其他标签 |
| [AttributeHandler](../src/application/contracts/AttributeHandler.ts) | application/AttributeService.ts：apply（由 SetCommand.execute 调用） | BoxAttributes | 无匹配沿用原白名单；多匹配拒绝；异步或部分执行失败回滚，不再回退默认处理 |

所有类别的注册名必须唯一。PluginHost.activate 使用暂存注册，核对 package.json 的 contributes 后才提交；校验失败释放本次资源，既有成功插件不受影响。图形树继续由 SvgDocument / GroupShape 维护唯一 id、父子一致、归属、顺序和无环等不变量。

## 4. 两种装配与配置契约

构建完成后，在项目根目录选择一种方式启动。

代码装配：

```cmd
node dist/main.js
```

配置装配：

```cmd
node dist/main.js --config plugins.config.json
```

代码方式在 EditorBootstrap.activateCodePlugins 中导入实例及包清单；配置方式由 PluginLoader.loadConfig 解析模块并取得默认导出。两者最终共用 PluginHost.activate。插件通过已安装的 `pj/plugin-api` 包入口使用公开接口，独立包有自己的构建和测试命令。当前配置示例：

```json
{
  "plugins": [
    { "module": "./plugins/plugin-stats" },
    { "module": "./plugins/plugin-dir" },
    { "module": "./plugins/plugin-shape-box" },
    { "module": "./plugins/plugin-tree-star" }
  ]
}
```

按数组顺序加载；enabled 缺省为启用，false 完全跳过；options 原样传入插件，由插件验证。相对路径相对配置文件目录解析，包名使用 Node 模块解析规则。显式 --config 不叠加代码方式的可选插件；空 plugins 数组保留 Phase 1 内置能力。加载器不包含具体插件名称映射。

| 失败情况 | 对外错误（之后继续启动） |
| --- | --- |
| 顶层模块找不到 | `error: plugin not found: <module>` |
| 无默认导出 | `error: plugin has no default export: <module>` |
| 声明与实际注册不符 | `error: plugin manifest mismatch: <name> (declared: …, registered: …)` |
| 求值、依赖或 activate 失败 | `error: plugin failed to activate: <name> (<reason>)` |

重复注册报 `error: duplicate registration: <category>/<name>`；非法配置报 `error: invalid plugin config` 并仅保留内置能力。清单校验、重复注册及激活失败均撤销当前插件的暂存注册和资源。

## 5. 关键决策（ADR）

| 决策 | 选择与理由 |
| --- | --- |
| ADR-01 属性事务 | handles 读取冻结的图形描述；apply 经受控 getShape/setAttribute 操作子部件。多处理器命中直接拒绝，避免配置顺序改变语义。处理器同步执行，局部事务记录字段初值和终值；一次 set 仅一个 undo 单元。部分写入失败逆序回滚，失败不改历史；undo/redo 使用记录，不重跑处理器 |
| ADR-02 box 读写与降级 | 逻辑类型 box、原生标签 g，保存 data-kind="box"。完整子树构造后再校验必需 rect/text，禁止删除或移出必需部件、禁止解组；支持整体变换。未加载插件时读为普通 g 并保留标记；已加载但结构无效则拒绝整次读取，避免静默丢失语义 |
| ADR-03 dirty 语义与传播 | 比较当前规范化内容和保存基线，undo 回到基线后星号消失；子树变化向祖先及根传播，位置顺序和画布也参与比较。成功 init/read/save 建立基线，失败 IO 不更新。状态封装在标签实例中；按 order、注册名组合，固定得到 `(box) *` |
| ADR-04 激活校验时机 | activate 同步完成暂存注册，贡献类别和名称集合与 contributes 一致后一次提交；失败回滚当前插件并继续。命令执行仍可返回 Promise，使异步文件 IO 与目录读取按输入顺序完成 |

## 6. VSCode 实践

extension.ts 的 activate 向 VSCode 注册 SvgFileDecorationProvider 和 SvgDocumentSymbolProvider，资源放入 context.subscriptions。VSCode 决定何时调用提供者，负责 Explorer、Outline、导航和生命周期；插件只返回标记或符号数据，不修改文件。

文件装饰具有“附加显示”的意图，但 FileDecorationProvider 是宿主回调协议，没有包装同一个 Component 接口，不能直接等同经典 Decorator。它把注入的文件查询结果转换为 FileDecoration，也具有 Adapter 的适配意图，但被适配的是回调而非独立 Adaptee 类。CLI 的 TreeLineRenderer 包装链明确实现 Decorator；大纲提供者实现 Adapter，将 XmlOutlineParser 的位置树转换为 VSCode DocumentSymbol 的 children、range、selectionRange，由宿主显示并点击定位。

CLI 的 SvgReader 会补 id、限制图形和属性、构造编辑模型，且没有源码区间，因此没有直接复用到大纲。VSCode 使用独立 sax 解析层，保留任意 XML 元素层级与 UTF-16 区间；从内存读取最新文本，无 id 节点仍显示标签，不完整 XML 返回空大纲。可复用的是遍历思路和 SVG 测试场景，CLI 领域对象不适合作为任意 XML 的展示模型。

下图为 VSCode 扩展的手动测试运行截图。编辑更新、不完整 XML、取消请求及源码区间正确性由自动测试验证。

![VSCode 文件标记、大纲与源码定位](<pj1-phase2/vscode插件截图.png>)

## 7. 验收、过程与指标

| 验收项 | 测试指令 / 输入 | 结果与证据 |
| --- | --- | --- |
| 自动测试 | `npm run check`、`npm test`；`npm --prefix extensions\vscode-svg run check`、`npm --prefix extensions\vscode-svg test` | CLI/四插件 301 项、VSCode 19 项通过，包含类型检查与构建；[原始日志](evidence/README.md) |
| 手动测试 | 按[启动与核对步骤](evidence/manual-commands.md)，执行 [manual-demo.txt](transcript/manual-demo.txt) 中四段命令：基础编辑、结构操作、box/标签/读写、失败与历史 | 结果通过，5 条错误均为预期；[逐项摘要](evidence/manual-summary.md)、[原始输出](evidence/manual-output.txt) |
| 双装配 | 将 [cli-1.txt](transcript/cli-1.txt)、[flowchart-box.txt](transcript/flowchart-box.txt)、[plugin-commands.txt](transcript/plugin-commands.txt) 分别输入代码/配置方式；[运行及 fc /b 指令](evidence/comparison/README.md) | 比较基础会话、box 流程图、stats/dir 查询。主线代码/配置及 B 演示配置三份输出逐字节一致；[输入—输出对应表](evidence/comparison/README.md)、[比较结果](evidence/comparison/result.json) |
| Phase 1 兼容 | 用[空插件配置](evidence/comparison/plugins-empty.json)运行 [cli-1.txt](transcript/cli-1.txt) 和 [flowchart-basic.txt](transcript/flowchart-basic.txt)；[运行及 fc /b 指令](evidence/comparison/README.md) | 当前禁用插件版与真实 final 的基础编辑、手工流程图输出逐字节一致；对应 `.disabled` / `.final` 日志见[比较记录](evidence/comparison/README.md)。cwd 固定，日志在目录外 |
| A 接入 stats | main 提交 `4296e74`，新增 plugin-stats，提供 `stats` 命令 | src 只改组合根，内核不变；[提交文件清单](evidence/git/stats.name-status.txt) |
| A 接入 dir | main 提交 `8c393e4`，新增 plugin-dir，提供 `dir` 命令 | src 只改组合根，内核及既有 stats 不变；[提交文件清单](evidence/git/dir.name-status.txt) |
| A 接入 box 与星号 | main 提交 `426d38e`，新增 plugin-shape-box（图形、属性语义、类型标签）和 plugin-tree-star（修改星号） | src 只改组合根，内核及既有 stats/dir 不变；[提交文件清单](evidence/git/box-star.name-status.txt) |
| B 配置接入四包 | demo/config-plugins 提交 `dc2691f`，从框架基线 d51203e 新增上述四个同源插件，通过 plugins.config.json 启用 | 已有 src 零变化，四包与 A 完全相同；[提交文件清单](evidence/git/config-B.name-status.txt)、[差异复核指令](evidence/git/README.md) |
| 代码指标 | `node scripts/generate-metrics.cjs final HEAD`，交付打标后可将 HEAD 换为 p2 | Git 历史自动生成[行数与复杂度增量](../docs/metrics/summary.md)、[文件清单和职责](../docs/metrics/files.md)，VSCode 单列；[统计口径](../docs/metrics/README.md) |

开发按“VSCode 实践 → 四扩展点与事务/事件 → 通用加载 → 独立业务插件 → 交付验证”推进，采用 AI 辅助设计与编码，通过分步代码审查、自动测试和手动测试确认实现。关键修订包括采用局部恢复实现撤销、修正大纲导航打开预览的问题，以及补充独立 B 提交验证配置接入。

