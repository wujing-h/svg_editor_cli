# 文件清单与职责（自动生成）

## 基线：final (4ab7562)

| 文件 | 分类 | 物理行 | 非空行 | CCN | 职责（源码首行） |
| --- | --- | ---: | ---: | ---: | --- |
| src/application/CommandArguments.ts | 内核 | 39 | 33 | 10 | 校验命令参数数量并解析十进制数字，供具体命令复用。 |
| src/application/CommandDispatcher.ts | 内核 | 86 | 82 | 22 | 集中将命令名转换为命令对象，并通过统一接口执行。 |
| src/application/CommandHistory.ts | 内核 | 55 | 49 | 8 | 管理编辑历史，仅在执行或恢复成功后更新 undo/redo 栈。 |
| src/application/EditCommand.ts | 内核 | 10 | 9 | 0 | 定义可撤销编辑的同步执行与局部恢复契约。 |
| src/application/EditorSession.ts | 内核 | 101 | 90 | 18 | 管理当前文档，协调命令执行、编辑历史与文档操作后的历史限制。 |
| src/application/PlacementCommand.ts | 内核 | 59 | 52 | 8 | 共享换父和同级换位的历史流程，通过文档恢复前后局部位置。 |
| src/application/commands/AddToCommand.ts | 内核 | 27 | 24 | 4 | 将已有图形子树移入指定容器，作为最后一个子节点。 |
| src/application/commands/BackCommand.ts | 内核 | 22 | 19 | 3 | 将图形移到同级绘制顺序开头，使其位于最后层。 |
| src/application/commands/CanvasCommand.ts | 内核 | 42 | 37 | 3 | 查询当前画布，或在完整校验后修改画布尺寸。 |
| src/application/commands/CreateCommand.ts | 内核 | 85 | 77 | 16 | 创建图形并保存对象及原位置，供撤销移除和重做接回。 |
| src/application/commands/DeleteCommand.ts | 内核 | 62 | 55 | 10 | 删除一个图形子树，保留原对象、父容器和顺序以支持局部恢复。 |
| src/application/commands/FrontCommand.ts | 内核 | 22 | 19 | 3 | 将图形移到同级绘制顺序末尾，使其位于最前层。 |
| src/application/commands/GroupCommand.ts | 内核 | 60 | 53 | 9 | 通过工厂创建容器并收编已有图形，保存局部结构变化以撤销和重做。 |
| src/application/commands/HelpCommand.ts | 内核 | 42 | 38 | 3 | 提供当前 CLI 已支持命令的语法与说明。 |
| src/application/commands/InitCommand.ts | 内核 | 30 | 26 | 2 | 校验 init 参数并建立默认或指定尺寸的新文档。 |
| src/application/commands/MoveCommand.ts | 内核 | 87 | 80 | 15 | 委派统一图形移动，保存前后局部几何以准确撤销和重做。 |
| src/application/commands/ReadCommand.ts | 内核 | 26 | 23 | 2 | 异步读入 SVG，返回成功摘要及缺 id 警告，历史与路径更新由会话决定。 |
| src/application/commands/RedoCommand.ts | 内核 | 21 | 18 | 2 | 校验 redo 参数并请求会话重做一个编辑单元。 |
| src/application/commands/SaveCommand.ts | 内核 | 27 | 24 | 3 | 保存当前文档到显式或关联路径，由会话在 IO 成功后更新历史。 |
| src/application/commands/ScaleCommand.ts | 内核 | 77 | 70 | 11 | 委派统一图形缩放，保存前后局部几何以准确撤销和重做。 |
| src/application/commands/SetCommand.ts | 内核 | 73 | 66 | 10 | 通过统一图形接口修改一个属性，保存原值和缺失状态以支持撤销重做。 |
| src/application/commands/ShowCommand.ts | 内核 | 26 | 23 | 3 | 查询单个图形的属性与父容器，返回只读展示数据。 |
| src/application/commands/TreeCommand.ts | 内核 | 28 | 25 | 4 | 查询全文档或指定图形的子树，返回独立描述而不改变历史。 |
| src/application/commands/UndoCommand.ts | 内核 | 21 | 18 | 2 | 校验 undo 参数并请求会话撤销一个编辑单元。 |
| src/application/commands/UngroupCommand.ts | 内核 | 47 | 40 | 7 | 解散非根级容器并提升子节点，保留原组对象和顺序以支持局部恢复。 |
| src/application/contracts/Command.ts | 内核 | 6 | 5 | 0 | 定义统一命令执行接口，兼容同步编辑与异步文件操作。 |
| src/application/contracts/CommandInput.ts | 内核 | 7 | 6 | 0 | 定义 CLI 提交给应用层的只读命令输入。 |
| src/application/contracts/CommandResult.ts | 内核 | 28 | 27 | 0 | 定义命令返回的展示数据，让终端排版与应用逻辑分开。 |
| src/application/contracts/CommandToken.ts | 内核 | 5 | 5 | 0 | 保存命令参数的文本与引用信息，避免将引号内的关键字误作语法。 |
| src/application/contracts/DocumentReadResult.ts | 内核 | 8 | 7 | 0 | 传递已完整解析的独立文档、元素计数及待成功后输出的缺 id 警告。 |
| src/application/contracts/DocumentStore.ts | 内核 | 9 | 8 | 0 | 定义文档读写契约，由组装入口注入具体存储，隔离文件和 XML 实现。 |
| src/application/contracts/ShapeView.ts | 内核 | 4 | 3 | 0 | 通过应用层契约传递独立只读图形描述，CLI 不接触可变领域对象。 |
| src/cli/CliApplication.ts | 内核 | 58 | 52 | 10 | 运行逐行 SVG 命令终端，等待执行结果并维持统一错误输出。 |
| src/cli/CliFormatter.ts | 内核 | 124 | 109 | 51 | 排版命令摘要、图形查询、属性变化与帮助内容，统一 CLI 的错误前缀。 |
| src/cli/CommandLineParser.ts | 内核 | 73 | 62 | 19 | 解析逐行 CLI 输入，保留双引号文本并正确区分注释与颜色。 |
| src/domain/AttributeSnapshot.ts | 内核 | 22 | 19 | 3 | 保存一个属性的局部值及缺失状态，绑定原图形以支持准确恢复。 |
| src/domain/CanvasSize.ts | 内核 | 5 | 5 | 0 | 提供画布尺寸的只读描述，避免向外暴露文档内部状态。 |
| src/domain/CircleShape.ts | 内核 | 96 | 82 | 18 | 封装圆的圆心和半径，支持原子几何操作与局部恢复。 |
| src/domain/EllipseShape.ts | 内核 | 101 | 87 | 20 | 封装椭圆圆心与两轴半径，支持原子几何操作与局部恢复。 |
| src/domain/GeometrySnapshot.ts | 内核 | 40 | 35 | 7 | 保存图形及其子孙的局部几何值，并防止恢复到其他对象。 |
| src/domain/GroupShape.ts | 内核 | 97 | 84 | 24 | 封装有序容器，通过多态递归操作子图形并保证整组几何修改原子性。 |
| src/domain/GroupingChange.ts | 内核 | 39 | 34 | 8 | 保存分组或解组前后受影响的子列表，绑定原文档和组对象供局部恢复。 |
| src/domain/LineShape.ts | 内核 | 100 | 86 | 18 | 封装线段的两个端点，支持原子几何操作与局部恢复。 |
| src/domain/PlacementChange.ts | 内核 | 7 | 6 | 0 | 保存一次换父或同级换位的前后位置，不复制整份文档。 |
| src/domain/RectShape.ts | 内核 | 119 | 105 | 20 | 封装矩形几何，支持原子移动、缩放以及准确的局部恢复。 |
| src/domain/Shape.ts | 内核 | 193 | 174 | 51 | 封装图形身份与公共样式，定义统一几何、属性修改及局部恢复契约。 |
| src/domain/ShapeDescription.ts | 内核 | 13 | 13 | 0 | 提供图形的只读属性描述，供后续 CLI 展示与 SVG 输出使用。 |
| src/domain/ShapeFactory.ts | 内核 | 208 | 196 | 58 | 集中创建六种内置图形，共享位置参数与属性描述的类型分派。 |
| src/domain/ShapeStyles.ts | 内核 | 9 | 9 | 0 | 描述图形的可选初始样式，区分属性缺失与显式设置。 |
| src/domain/SiblingOrder.ts | 内核 | 8 | 7 | 0 | 描述一个受影响父容器的子节点顺序，根级节点以 undefined 表示父容器。 |
| src/domain/SubtreeLocation.ts | 内核 | 11 | 10 | 0 | 记录子树的文档、对象、父容器与位置，供删除或换位的局部恢复使用。 |
| src/domain/SvgDocument.ts | 内核 | 441 | 408 | 142 | 管理画布与有序图形树，受控维护唯一 id、父子关系及文档归属。 |
| src/domain/TextShape.ts | 内核 | 95 | 81 | 19 | 封装文字坐标与原始内容，几何操作保留文本并支持局部恢复。 |
| src/domain/internal/TreeMutationToken.ts | 内核 | 3 | 3 | 0 | 为树结构的内部写入口提供凭据，普通调用方通过 SvgDocument 操作。 |
| src/infrastructure/SvgFileStore.ts | 内核 | 59 | 55 | 7 | 实现 UTF-8 SVG 读写，构造独立文档并以临时文件保存，转换文件错误。 |
| src/infrastructure/SvgReader.ts | 内核 | 200 | 189 | 76 | 严格解析限定范围的 SVG，预留全部显式 id 后补全匿名元素并构造独立文档。 |
| src/infrastructure/SvgWriter.ts | 内核 | 72 | 67 | 18 | 将只读文档描述序列化为独立 SVG，保留顺序并转义 XML 属性与文本。 |
| src/main.ts | 装配处 | 20 | 18 | 1 | 组装 CLI 的解析、分发与展示对象，并启动程序。 |

## 目标：HEAD (fc86fcb)

| 文件 | 分类 | 物理行 | 非空行 | CCN | 职责（源码首行） |
| --- | --- | ---: | ---: | ---: | --- |
| extensions/vscode-svg/src/SvgDocumentSymbolProvider.ts | VSCode | 33 | 30 | 9 | 将 XML 位置树适配为 VSCode 原生大纲节点，由宿主负责显示、刷新和点击导航。 |
| extensions/vscode-svg/src/SvgFileDecorationProvider.ts | VSCode | 29 | 24 | 7 | 为真实 SVG 文件提供 Explorer 行尾标记，跳过目录、读取失败和已取消的请求。 |
| extensions/vscode-svg/src/XmlOutlineNode.ts | VSCode | 9 | 9 | 0 | 定义大纲的只读展示节点；源码区间使用从零开始、末端不包含在内的 UTF-16 偏移。 |
| extensions/vscode-svg/src/XmlOutlineParser.ts | VSCode | 67 | 61 | 18 | 把 XML 文本解析成带源码区间的元素树，不创建图形对象或补写 id。 |
| extensions/vscode-svg/src/extension.ts | VSCode | 22 | 21 | 2 | 组装 VSCode 扩展功能，将提供者注册给宿主并管理资源释放。 |
| plugins/plugin-dir/src/DirCommand.ts | 插件 | 44 | 40 | 15 | 通过目录接口列出当前目录直接子项，稳定排序且不访问或修改 SVG 文档。 |
| plugins/plugin-dir/src/DirPlugin.ts | 插件 | 20 | 18 | 3 | 注册 dir 的帮助和命令工厂，仅依赖宿主提供的目录端口。 |
| plugins/plugin-dir/src/index.ts | 插件 | 6 | 5 | 0 | 提供 dir 插件的默认实例及可独立检查、测试的公开类。 |
| plugins/plugin-shape-box/src/BoxAttributes.ts | 插件 | 18 | 15 | 9 | 将 box 的 fill/label 映射到必要子部件，只经框架事务修改属性。 |
| plugins/plugin-shape-box/src/BoxPlugin.ts | 插件 | 14 | 13 | 2 | 同包注册 box 提供者、属性策略和类型标签，通过宿主原子激活。 |
| plugins/plugin-shape-box/src/BoxProvider.ts | 插件 | 91 | 85 | 33 | 解析 box 参数并离线创建模板，或从完整原生 g 子树恢复复合语义。 |
| plugins/plugin-shape-box/src/BoxShape.ts | 插件 | 36 | 31 | 10 | 以普通 g 组合矩形和标题，保护必要部件的对象身份并禁止解组。 |
| plugins/plugin-shape-box/src/BoxTypeLabel.ts | 插件 | 11 | 9 | 2 | 为已恢复 box 语义的容器行追加类型标签，不依赖其他树标签。 |
| plugins/plugin-shape-box/src/index.ts | 插件 | 8 | 8 | 0 | 导出 box 包的默认实例及可独立测试的图形和扩展实现。 |
| plugins/plugin-stats/src/StatsCommand.ts | 插件 | 44 | 41 | 12 | 按深度优先首次出现顺序统计叶子类型，容器与根 SVG 分开计数。 |
| plugins/plugin-stats/src/StatsPlugin.ts | 插件 | 21 | 19 | 3 | 注册 stats 的命令元数据与构造入口，不依赖内置命令表或其他插件。 |
| plugins/plugin-stats/src/index.ts | 插件 | 6 | 5 | 0 | 提供 stats 插件包的默认实例和可独立测试的公开类。 |
| plugins/plugin-tree-star/src/ContentSnapshot.ts | 插件 | 28 | 24 | 12 | 规范化画布、属性、子树和节点位置，封装内容比较而非记录操作次数。 |
| plugins/plugin-tree-star/src/ModifiedStar.ts | 插件 | 29 | 25 | 11 | 实例内维护保存基线和当前内容，为变化节点、祖先和 SVG 根提供星号。 |
| plugins/plugin-tree-star/src/ModifiedStarPlugin.ts | 插件 | 17 | 15 | 4 | 每次激活创建独立标签实例，并把只读会话订阅交给宿主释放。 |
| plugins/plugin-tree-star/src/index.ts | 插件 | 6 | 6 | 0 | 导出修改星号插件的默认实例与可独立测试的状态类。 |
| src/application/AttributeChange.ts | 内核 | 64 | 58 | 15 | 保存一批属性的局部前后值，原子恢复并在中途失败时补偿已尝试的写入。 |
| src/application/AttributeService.ts | 内核 | 67 | 62 | 15 | 选择唯一属性策略，无匹配时保留原白名单，并把整次修改交给局部事务。 |
| src/application/AttributeTransaction.ts | 内核 | 87 | 79 | 19 | 受控执行一次属性编辑，合并重复字段记录并在成功或失败后关闭插件写入口。 |
| src/application/CommandArguments.ts | 内核 | 39 | 33 | 10 | 校验命令参数数量并解析十进制数字，供具体命令复用。 |
| src/application/CommandDispatcher.ts | 内核 | 20 | 17 | 2 | 从注入的注册表取得命令对象，交给会话统一执行及管理历史。 |
| src/application/CommandHistory.ts | 内核 | 55 | 49 | 8 | 管理编辑历史，仅在执行或恢复成功后更新 undo/redo 栈。 |
| src/application/CommandRegistry.ts | 内核 | 39 | 35 | 15 | 按名称管理命令构造入口和帮助信息，不依赖具体命令实现。 |
| src/application/EditCommand.ts | 内核 | 10 | 9 | 0 | 定义可撤销编辑的同步执行与局部恢复契约。 |
| src/application/EditorSession.ts | 内核 | 180 | 165 | 41 | 管理当前文档，协调命令执行、编辑历史与文档操作后的历史限制。 |
| src/application/ExtensionRegistry.ts | 内核 | 39 | 33 | 12 | 统一管理具名扩展，拒绝重复注册，为插件回滚提供精确撤销入口。 |
| src/application/PlacementCommand.ts | 内核 | 59 | 52 | 8 | 共享换父和同级换位的历史流程，通过文档恢复前后局部位置。 |
| src/application/PluginHost.ts | 内核 | 187 | 178 | 70 | 暂存并校验插件注册，成功后统一接入，失败时回滚本次扩展和资源。 |
| src/application/ReadonlyData.ts | 内核 | 16 | 15 | 5 | 复制并递归冻结纯描述数据，避免扩展通过查询结果影响文档或其他扩展。 |
| src/application/ShapeRegistry.ts | 内核 | 10 | 9 | 4 | 校验并注册图形提供者，为领域工厂提供按名称查询的入口。 |
| src/application/contracts/AttributeHandler.ts | 内核 | 15 | 13 | 0 | 定义同步属性策略和仅在本次编辑内有效的只读查询、受控写入接口。 |
| src/application/contracts/Command.ts | 内核 | 6 | 5 | 0 | 定义统一命令执行接口，兼容同步编辑与异步文件操作。 |
| src/application/contracts/CommandDefinition.ts | 内核 | 10 | 9 | 0 | 定义命令注册信息，将名称、帮助文案与对象构造入口放在一起。 |
| src/application/contracts/CommandInput.ts | 内核 | 7 | 6 | 0 | 定义 CLI 提交给应用层的只读命令输入。 |
| src/application/contracts/CommandResult.ts | 内核 | 30 | 29 | 0 | 定义命令返回的展示数据，让终端排版与应用逻辑分开。 |
| src/application/contracts/CommandToken.ts | 内核 | 5 | 5 | 0 | 保存命令参数的文本与引用信息，避免将引号内的关键字误作语法。 |
| src/application/contracts/DirectoryReader.ts | 内核 | 10 | 9 | 0 | 定义目录查询端口，命令无需直接依赖 Node.js 文件系统。 |
| src/application/contracts/DocumentReadResult.ts | 内核 | 8 | 7 | 0 | 传递已完整解析的独立文档、元素计数及待成功后输出的缺 id 警告。 |
| src/application/contracts/DocumentStore.ts | 内核 | 9 | 8 | 0 | 定义文档读写契约，由组装入口注入具体存储，隔离文件和 XML 实现。 |
| src/application/contracts/EditorServices.ts | 内核 | 16 | 15 | 0 | 向插件提供公开文档查询和目录访问服务，不暴露宿主装配对象。 |
| src/application/contracts/Plugin.ts | 内核 | 6 | 5 | 0 | 定义插件同步注册生命周期；实际命令仍可异步执行文件操作。 |
| src/application/contracts/PluginContext.ts | 内核 | 20 | 18 | 0 | 提供插件激活期间的受控注册入口，以及可释放资源和公开服务。 |
| src/application/contracts/PluginManifest.ts | 内核 | 10 | 10 | 0 | 定义插件清单中的四类贡献名称，与实际暂存注册逐项比较。 |
| src/application/contracts/SessionEvent.ts | 内核 | 18 | 14 | 0 | 公开独立只读内容快照和成功操作事件，供插件维护自己的内容基线。 |
| src/application/contracts/ShapeProvider.ts | 内核 | 2 | 2 | 0 | 沿用应用层契约入口，实际协议定义在领域侧，避免领域工厂反向依赖应用层。 |
| src/application/contracts/ShapeView.ts | 内核 | 4 | 3 | 0 | 通过应用层契约传递独立只读图形描述，CLI 不接触可变领域对象。 |
| src/application/contracts/TreeDecorator.ts | 内核 | 16 | 14 | 0 | 定义树行后缀扩展；标签只读取描述，不修改图形或基础渲染结果。 |
| src/bootstrap/EditorBootstrap.ts | 装配处 | 75 | 70 | 11 | 集中装配默认编辑器，并在启动 REPL 前选择代码或配置方式激活可选插件。 |
| src/bootstrap/PluginConfig.ts | 装配处 | 42 | 37 | 17 | 整体读取并校验插件配置，确保坏配置不会先激活前半段插件。 |
| src/bootstrap/PluginLoader.ts | 装配处 | 111 | 103 | 36 | 在装配侧解析插件模块及包清单，代码和配置装配共用宿主激活与错误隔离。 |
| src/builtins/BuiltinCommands.ts | 插件 | 93 | 88 | 27 | 装配原有内置命令并提供清单，命令行为和帮助顺序保持不变。 |
| src/builtins/BuiltinShapeProvider.ts | 插件 | 175 | 163 | 61 | 按一种内置图形的声明解析参数和 SVG 属性，保留原有校验及默认值规则。 |
| src/builtins/BuiltinShapes.ts | 插件 | 71 | 68 | 10 | 把六种内置图形装配为独立提供者实例，内核工厂不再枚举类型。 |
| src/builtins/commands/AddToCommand.ts | 插件 | 27 | 24 | 4 | 将已有图形子树移入指定容器，作为最后一个子节点。 |
| src/builtins/commands/BackCommand.ts | 插件 | 22 | 19 | 3 | 将图形移到同级绘制顺序开头，使其位于最后层。 |
| src/builtins/commands/CanvasCommand.ts | 插件 | 42 | 37 | 3 | 查询当前画布，或在完整校验后修改画布尺寸。 |
| src/builtins/commands/CreateCommand.ts | 插件 | 85 | 77 | 16 | 创建图形并保存对象及原位置，供撤销移除和重做接回。 |
| src/builtins/commands/DeleteCommand.ts | 插件 | 62 | 55 | 10 | 删除一个图形子树，保留原对象、父容器和顺序以支持局部恢复。 |
| src/builtins/commands/FrontCommand.ts | 插件 | 22 | 19 | 3 | 将图形移到同级绘制顺序末尾，使其位于最前层。 |
| src/builtins/commands/GroupCommand.ts | 插件 | 60 | 53 | 9 | 通过工厂创建容器并收编已有图形，保存局部结构变化以撤销和重做。 |
| src/builtins/commands/HelpCommand.ts | 插件 | 22 | 19 | 3 | 读取已注册命令的帮助信息，新增命令无需维护固定帮助列表。 |
| src/builtins/commands/InitCommand.ts | 插件 | 30 | 26 | 2 | 校验 init 参数并建立默认或指定尺寸的新文档。 |
| src/builtins/commands/MoveCommand.ts | 插件 | 87 | 80 | 15 | 委派统一图形移动，保存前后局部几何以准确撤销和重做。 |
| src/builtins/commands/ReadCommand.ts | 插件 | 26 | 23 | 2 | 异步读入 SVG，返回成功摘要及缺 id 警告，历史与路径更新由会话决定。 |
| src/builtins/commands/RedoCommand.ts | 插件 | 21 | 18 | 2 | 校验 redo 参数并请求会话重做一个编辑单元。 |
| src/builtins/commands/SaveCommand.ts | 插件 | 27 | 24 | 3 | 保存当前文档到显式或关联路径，由会话在 IO 成功后更新历史。 |
| src/builtins/commands/ScaleCommand.ts | 插件 | 77 | 70 | 11 | 委派统一图形缩放，保存前后局部几何以准确撤销和重做。 |
| src/builtins/commands/SetCommand.ts | 插件 | 63 | 57 | 9 | 执行属性策略并将整批局部属性修改作为一个可撤销命令。 |
| src/builtins/commands/ShowCommand.ts | 插件 | 26 | 23 | 3 | 查询单个图形的属性与父容器，返回只读展示数据。 |
| src/builtins/commands/TreeCommand.ts | 插件 | 28 | 25 | 4 | 查询全文档或指定图形的子树，返回独立描述而不改变历史。 |
| src/builtins/commands/UndoCommand.ts | 插件 | 21 | 18 | 2 | 校验 undo 参数并请求会话撤销一个编辑单元。 |
| src/builtins/commands/UngroupCommand.ts | 插件 | 47 | 40 | 7 | 解散非根级容器并提升子节点，保留原组对象和顺序以支持局部恢复。 |
| src/cli/BaseTreeLineRenderer.ts | 内核 | 33 | 32 | 13 | 生成原有 SVG 根行和图形树行，不包含任何插件标签或类型分支。 |
| src/cli/CliApplication.ts | 内核 | 58 | 52 | 10 | 运行逐行 SVG 命令终端，等待执行结果并维持统一错误输出。 |
| src/cli/CliFormatter.ts | 内核 | 120 | 107 | 43 | 排版命令摘要、图形查询、属性变化与帮助内容，统一 CLI 的错误前缀。 |
| src/cli/CommandLineParser.ts | 内核 | 73 | 62 | 19 | 解析逐行 CLI 输入，保留双引号文本并正确区分注释与颜色。 |
| src/cli/DecoratedTreeLineRenderer.ts | 内核 | 46 | 43 | 15 | 包装同一树行接口并追加单行标签，隔离违规标签而保留内层输出。 |
| src/cli/ShapeText.ts | 内核 | 21 | 17 | 10 | 共用图形标签、属性和单行值格式，保持树与 show 的原有排版规则。 |
| src/cli/TreeLineRenderer.ts | 内核 | 6 | 5 | 0 | 统一基础树行和包装树行的渲染接口，缩进与连接线由调用者管理。 |
| src/domain/AttributeSnapshot.ts | 内核 | 22 | 19 | 3 | 保存一个属性的局部值及缺失状态，绑定原图形以支持准确恢复。 |
| src/domain/CanvasSize.ts | 内核 | 5 | 5 | 0 | 提供画布尺寸的只读描述，避免向外暴露文档内部状态。 |
| src/domain/CircleShape.ts | 内核 | 96 | 82 | 18 | 封装圆的圆心和半径，支持原子几何操作与局部恢复。 |
| src/domain/EllipseShape.ts | 内核 | 101 | 87 | 20 | 封装椭圆圆心与两轴半径，支持原子几何操作与局部恢复。 |
| src/domain/GeometrySnapshot.ts | 内核 | 40 | 35 | 7 | 保存图形及其子孙的局部几何值，并防止恢复到其他对象。 |
| src/domain/GroupShape.ts | 内核 | 135 | 120 | 35 | 封装有序容器，通过多态递归操作子图形并保证整组几何修改原子性。 |
| src/domain/GroupingChange.ts | 内核 | 39 | 34 | 8 | 保存分组或解组前后受影响的子列表，绑定原文档和组对象供局部恢复。 |
| src/domain/LineShape.ts | 内核 | 100 | 86 | 18 | 封装线段的两个端点，支持原子几何操作与局部恢复。 |
| src/domain/PlacementChange.ts | 内核 | 7 | 6 | 0 | 保存一次换父或同级换位的前后位置，不复制整份文档。 |
| src/domain/RectShape.ts | 内核 | 119 | 105 | 20 | 封装矩形几何，支持原子移动、缩放以及准确的局部恢复。 |
| src/domain/Shape.ts | 内核 | 198 | 178 | 52 | 封装图形身份与公共样式，定义统一几何、属性修改及局部恢复契约。 |
| src/domain/ShapeDescription.ts | 内核 | 15 | 15 | 0 | 提供图形的只读属性描述，供后续 CLI 展示与 SVG 输出使用。 |
| src/domain/ShapeFactory.ts | 内核 | 61 | 54 | 24 | 通过注入的提供者查询接口创建图形，不预置任何图形类型或参数分支。 |
| src/domain/ShapeProvider.ts | 内核 | 24 | 20 | 0 | 定义领域侧图形构造协议，工厂只依赖协议，不依赖应用层或内置类型。 |
| src/domain/ShapeStyles.ts | 内核 | 9 | 9 | 0 | 描述图形的可选初始样式，区分属性缺失与显式设置。 |
| src/domain/ShapeTree.ts | 内核 | 35 | 34 | 8 | 只读检查完整子树的身份、父子关系与容器规则，供离线构造和文档接入共用。 |
| src/domain/SiblingOrder.ts | 内核 | 8 | 7 | 0 | 描述一个受影响父容器的子节点顺序，根级节点以 undefined 表示父容器。 |
| src/domain/SubtreeLocation.ts | 内核 | 11 | 10 | 0 | 记录子树的文档、对象、父容器与位置，供删除或换位的局部恢复使用。 |
| src/domain/SvgDocument.ts | 内核 | 432 | 399 | 138 | 管理画布与有序图形树，受控维护唯一 id、父子关系及文档归属。 |
| src/domain/TextShape.ts | 内核 | 95 | 81 | 19 | 封装文字坐标与原始内容，几何操作保留文本并支持局部恢复。 |
| src/domain/internal/TreeMutationToken.ts | 内核 | 3 | 3 | 0 | 为树结构的内部写入口提供凭据，普通调用方通过 SvgDocument 操作。 |
| src/infrastructure/NodeDirectoryAdapter.ts | 内核 | 29 | 25 | 8 | 将 Node.js 当前目录和目录项查询适配为应用层目录访问接口。 |
| src/infrastructure/SvgFileStore.ts | 内核 | 59 | 55 | 7 | 实现 UTF-8 SVG 读写，构造独立文档并以临时文件保存，转换文件错误。 |
| src/infrastructure/SvgReader.ts | 内核 | 195 | 184 | 74 | 严格解析限定范围的 SVG，预留全部显式 id 后补全匿名元素并构造独立文档。 |
| src/infrastructure/SvgWriter.ts | 内核 | 72 | 67 | 18 | 将只读文档描述序列化为独立 SVG，保留顺序并转义 XML 属性与文本。 |
| src/main.ts | 装配处 | 16 | 13 | 3 | 把启动参数交给组合根，运行 CLI 并在退出时释放插件资源。 |
| src/plugin-api/index.ts | 内核 | 21 | 21 | 0 | 集中导出插件可依赖的契约和领域抽象，不暴露注册表内部或宿主装配。 |

