# 指标口径与复算

由仓库内 [generate-metrics.cjs](../../scripts/generate-metrics.cjs) 读取 `git ls-tree` / `git show` 自动生成，不扫描工作区源码，不统计依赖、构建产物、测试、文档或本脚本。使用项目已安装的 TypeScript 7.0.2 AST/API；历史内容只进入虚拟文件系统，无需检出分支或安装新依赖。

```cmd
node scripts/generate-metrics.cjs final HEAD
```

当前数据以交付前主线源码提交为目标，准确哈希见 [summary.md](summary.md)。创建交付标签 p2 后，可用相同口径复算：

```cmd
node scripts/generate-metrics.cjs final p2
```

报告提交仅增加文档及指标脚本时，统计范围内的源码和数字不变；业务源码变更后需重新生成。输出包括分类汇总 summary.md、两版本的逐文件职责与指标 files.md，以及原始数据 metrics.json。生成结果记录实际目标提交及哈希。

## 范围与分类

| 分类 | 路径及说明 |
| --- | --- |
| 内核 | src 中除下两类外的 .ts 运行源码；含领域模型、会话、CLI、基础设施、公开 API。Phase 1 原 application/commands 仍属于当时内核 |
| 装配处 | src/main.ts 和 src/bootstrap/**/*.ts，含组合根、配置及模块加载 |
| 插件 | src/builtins/**/*.ts 与 plugins/*/src/**/*.ts，含内置和可选实现 |
| VSCode（单列） | extensions/vscode-svg/src/**/*.ts，不混入 CLI 增量 |

内置命令从 application/commands 迁到 builtins 会发生分类转移；分类变化不代表这些代码全是新增。只纳入上述路径中的 TypeScript 源码，排除 .d.ts 声明文件。

## 行数与圈复杂度

- 物理行包含注释和空行，末尾换行不额外计一行；同时输出非空行。职责直接提取各版本源码第一行用途注释，不手工填数。
- 采用 TypeScript AST 的可复算 CCN 口径：每个带实现的函数、方法、构造器、访问器、箭头函数基数为 1；每个 if、条件表达式、循环、catch、非 default case、逻辑 && / || / ?? 加 1。嵌套函数独立计基数，分支只计一次。
- 函数外存在决策节点时，额外计算一个隐式顶层函数基数；纯接口/类型文件为 0。不计 else、switch 自身、可选链、参数默认值或类型层面的条件。跨工具比较时需统一决策节点及函数基数的统计口径。
- 复杂度增量反映接口校验、事务补偿和加载隔离等新增行为；总复杂度增加不直接等于可维护性下降，需结合模块边界与逐文件变化判断。
