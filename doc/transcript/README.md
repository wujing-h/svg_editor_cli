# 纯命令输入

这些 .txt 只包含命令，不含提示符或示例输出；对应原始输出见 [比较证据](../evidence/comparison/README.md)。

| 文件 | 来源 |
| --- | --- |
| [manual-demo.txt](manual-demo.txt) | 四段手动测试，覆盖基础、结构、box/标签/IO、失败与历史；[启动和核对方式](../evidence/manual-commands.md) |
| [cli-1.txt](cli-1.txt) | Phase 1 §6 基础会话，包含缺 id 的外部 SVG、失败分组及 IO 后撤销限制 |
| [flowchart-box.txt](flowchart-box.txt) | Phase 1 §6.1 版本 B 复合节点流程图 |
| [plugin-commands.txt](plugin-commands.txt) | stats、dir、help、box、保存及星号与 undo/redo 的组合 |
| [flowchart-basic.txt](flowchart-basic.txt) | Phase 1 §6.1 版本 A 手工流程图，用于附加 final 兼容比较 |

四个比较用会话的保存路径统一调整为 `../artifacts/`，从证据目录中的 fixed-cwd 启动，确保保存文件不会改变 dir 的直接子项。manual-demo 在项目根目录运行，保留手动测试的原始读写路径。CLI 不提供 exit 命令，文件重定向到 EOF 时正常结束进程。
