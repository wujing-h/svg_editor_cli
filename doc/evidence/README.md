# 验收证据索引

证据于 2026-11-11 整理，CLI 主线源码为 fc86fcb，配置接入演示为 dc2691f。正文见 [实验报告](../README.md)，不在正文堆放完整输出。

| 证据 | 内容与来源 |
| --- | --- |
| [cli-check.txt](automated/cli-check.txt)、[cli-tests.txt](automated/cli-tests.txt) | 本轮实际重新执行根项目类型检查和完整测试；301 项通过，测试命令内包含全部 CLI/插件构建 |
| [vscode-check.txt](automated/vscode-check.txt)、[vscode-tests.txt](automated/vscode-tests.txt) | 本轮实际重新执行扩展检查和测试；19 项通过，测试命令内包含扩展构建 |
| [metrics-check.txt](automated/metrics-check.txt) | 已知复杂度样例校验，并将重复从 Git 生成的 metrics.json 逐字节比较 |
| [manual-commands.md](manual-commands.md)、[manual-summary.md](manual-summary.md)、[manual-output.txt](manual-output.txt) | 四段人工演示的指令、核对点与原始结果；记录末尾含 B 分支构建/比较/提交/推送输出 |
| [manual-review.svg](manual-review.svg) | 人工保存产物，原生 SVG 元素及 data-kind 保留；不嵌入位图 |
| [comparison/](comparison/README.md) | 三类双装配、正式 B 接入分支输出、两段真实 final 对照；原始 stdout/stderr、固定目录与保存产物分开 |
| [git/](git/README.md) | A/B 的真实提交、文件差异、源码/既有插件保护范围检查和逐包一致性 |
| [VSCode 截图](../pj1-phase2/vscode插件截图.png) | 用户实际运行截图，按用户要求直接采用；动态更新与不完整 XML 不通过一张静态截图推断，自动测试单独覆盖 |

在项目根目录重新运行自动检查（CMD）：

```cmd
npm run check
npm test
npm --prefix extensions\vscode-svg run check
npm --prefix extensions\vscode-svg test
```

每个插件自己的测试可用 `npm --prefix plugins\plugin-dir test` 等方式独立运行；根测试同时包含它们。测试替身不需要真实编辑器 UI；VSCode 截图由用户提供，不宣称自动测试启动过真实 Extension Development Host。

Metrics 另见 [docs/metrics](../../docs/metrics/README.md)。当前测试日志对应上述源码候选；最终用户提交文档并新增 p2 后，若业务源码没有变化，仍对应相同代码。
