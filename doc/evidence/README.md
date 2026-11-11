# 验收证据索引

测试证据整理于 2026-11-11，CLI 主线源码为 fc86fcb，配置接入测试提交为 dc2691f。正文见 [实验报告](../README.md)，完整输出单独归档于本目录。

| 证据 | 内容与来源 |
| --- | --- |
| [cli-check.txt](automated/cli-check.txt)、[cli-tests.txt](automated/cli-tests.txt) | 根项目自动类型检查和完整测试；301 项通过，测试命令包含全部 CLI/插件构建 |
| [vscode-check.txt](automated/vscode-check.txt)、[vscode-tests.txt](automated/vscode-tests.txt) | 扩展自动类型检查和测试；19 项通过，测试命令包含扩展构建 |
| [metrics-check.txt](automated/metrics-check.txt) | 已知复杂度样例校验，并将重复从 Git 生成的 metrics.json 逐字节比较 |
| [manual-commands.md](manual-commands.md)、[manual-summary.md](manual-summary.md)、[manual-output.txt](manual-output.txt) | 四段手动测试的指令、核对点与原始结果；记录末尾含 B 分支构建/比较/提交/推送输出 |
| [manual-review.svg](manual-review.svg) | 手动测试保存的 SVG，保留原生元素及 data-kind |
| [comparison/](comparison/README.md) | 三类双装配、正式 B 接入分支输出、两段真实 final 对照；原始 stdout/stderr、固定目录与保存产物分开 |
| [git/](git/README.md) | A/B 的真实提交、文件差异、源码/既有插件保护范围检查和逐包一致性 |
| [VSCode 截图](../pj1-phase2/vscode插件截图.png) | VSCode 扩展手动测试截图；动态更新与不完整 XML 等行为另由自动测试覆盖 |

在项目根目录运行自动测试与类型检查（CMD）：

```cmd
npm run check
npm test
npm --prefix extensions\vscode-svg run check
npm --prefix extensions\vscode-svg test
```

各插件可用 `npm --prefix plugins\plugin-dir test` 等命令独立测试；根测试同时覆盖这些用例。VSCode 自动测试使用宿主接口替身，UI 效果通过 Extension Development Host 中的手动测试验证。

Metrics 见 [docs/metrics](../../docs/metrics/README.md)。测试日志对应上述源码提交；交付提交仅增加文档时，测试对应的业务代码保持不变。
