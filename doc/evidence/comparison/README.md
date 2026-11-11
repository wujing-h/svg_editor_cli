# 会话输出比较

2026-11-11 实测，使用 UTF-8 原始 stdout 字节比较，不过滤 warning/error、空白或行尾。所有自动对照进程 exit code 为 0，stderr 为空。

| 输入指令 | 验证内容 | 对应原始输出 | 每份字节数 / 结果 |
| --- | --- | --- | --- |
| [cli-1.txt](../../transcript/cli-1.txt) | 基础创建、分组、编辑、undo/redo、保存、读取与补 id | [代码](logs/cli-1.code.stdout.txt) / [配置](logs/cli-1.config.stdout.txt) / [B 演示配置](logs/cli-1.git-B.stdout.txt) | 1162，三份一致 |
| [flowchart-box.txt](../../transcript/flowchart-box.txt) | box 流程图的整体移动、属性设置、撤销、标签及保存 | [代码](logs/flowchart-box.code.stdout.txt) / [配置](logs/flowchart-box.config.stdout.txt) / [B 演示配置](logs/flowchart-box.git-B.stdout.txt) | 769，三份一致 |
| [plugin-commands.txt](../../transcript/plugin-commands.txt) | help、初始化前 dir、空/非空 stats、box 与标签、查询不破坏历史 | [代码](logs/plugin-commands.code.stdout.txt) / [配置](logs/plugin-commands.config.stdout.txt) / [B 演示配置](logs/plugin-commands.git-B.stdout.txt) | 3408，三份一致 |
| [cli-1.txt](../../transcript/cli-1.txt) | Phase 1 基础会话兼容性 | [真实 final](logs/cli-1.final.stdout.txt) / [禁用插件版](logs/cli-1.disabled.stdout.txt) | 1150，两份一致 |
| [flowchart-basic.txt](../../transcript/flowchart-basic.txt) | Phase 1 手工分组流程图兼容性 | [真实 final](logs/flowchart-basic.final.stdout.txt) / [禁用插件版](logs/flowchart-basic.disabled.stdout.txt) | 878，两份一致 |

- [result.json](result.json) 记录实际哈希与比较结果；logs/ 内 `.code`、`.config`、`.git-B`、`.final`、`.disabled` 分别对应上述运行。B 的 stdout 来源于用户运行，AI 已复核字节相同；用户的 fc 及构建成功记录保留在 [manual-output.txt](../manual-output.txt)。
- 主线 A 为 fc86fcb，正式 B 为 dc2691f。两种方式均按 stats、dir、box、star 顺序启用，无 options，每次进程从未初始化状态开始，使用相同输入、初始文件和 cwd。
- fixed-cwd/ 含 docs、.hidden、other.svg、sample.txt；只列直接子项。运行前后文件内容不变，日志及 artifacts/ 位于其外。other.svg 直接来自 Phase 1 §6 示例。
- final 是附注标签：result.json 的 final 字段是标签对象 175883f；finalCommit 是解引用源码提交 4ab7562。基线程序来自真实 `git archive final` 的源码构建，未用当前代码冒充旧版；临时源码快照和压缩包不放入交付材料。
- [plugins-empty.json](plugins-empty.json) 禁用全部可选插件；额外的 disabled-extensions 输出确认 stats/dir 未知、box 未知且 tree 无新增标签。基础会话的两条错误及缺 id 警告是预期行为，参与比较。

## 复演前准备（CMD）

以下各段按顺序在同一 CMD 窗口执行，开始时位于项目根目录。输入和输出都放在 fixed-cwd 之外。

```cmd
npm run build
set SVG_PROJECT_ROOT=%CD%
pushd doc\evidence\comparison\fixed-cwd
```

## 双装配：相同输入分别运行代码和配置方式

```cmd
for %T in (cli-1 flowchart-box plugin-commands) do node "%SVG_PROJECT_ROOT%\dist\main.js" < "%SVG_PROJECT_ROOT%\doc\transcript\%T.txt" > ..\logs\%T.rerun-code.stdout.txt
for %T in (cli-1 flowchart-box plugin-commands) do node "%SVG_PROJECT_ROOT%\dist\main.js" --config "%SVG_PROJECT_ROOT%\plugins.config.json" < "%SVG_PROJECT_ROOT%\doc\transcript\%T.txt" > ..\logs\%T.rerun-config.stdout.txt
for %T in (cli-1 flowchart-box plugin-commands) do fc /b ..\logs\%T.rerun-code.stdout.txt ..\logs\%T.rerun-config.stdout.txt
```

三次 fc 应无差异。另可检查历史 B 分支已经归档的真实输出：

```cmd
for %T in (cli-1 flowchart-box plugin-commands) do fc /b ..\logs\%T.code.stdout.txt ..\logs\%T.git-B.stdout.txt
```

## Phase 1 兼容：禁用插件版对照真实 final

仍在同一固定目录运行，通过空配置禁用四个可选插件（含标签），将新输出与已归档的真实 final 输出比较：

```cmd
for %T in (cli-1 flowchart-basic) do node "%SVG_PROJECT_ROOT%\dist\main.js" --config "%SVG_PROJECT_ROOT%\doc\evidence\comparison\plugins-empty.json" < "%SVG_PROJECT_ROOT%\doc\transcript\%T.txt" > ..\logs\%T.rerun-disabled.stdout.txt
for %T in (cli-1 flowchart-basic) do fc /b ..\logs\%T.final.stdout.txt ..\logs\%T.rerun-disabled.stdout.txt
popd
```

两次 fc 应无差异。`.final` 是原先从真实标签源码构建运行的输出；本段复演当前禁用插件版，不会把当前代码当作 final。

循环直接用于 CMD；放入 .bat 时 `%T` 改为 `%%T`。不向 fixed-cwd 新增日志或保存产物，不把输出内容混入命令文件。B 的历史源码边界由 [Git 证据](../git/README.md)独立证明，输出相同本身不替代接入差异判据。
