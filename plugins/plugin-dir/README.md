# dir 插件

通过 `pj/plugin-api` 的 DirectoryReader 查询 CLI 当前工作目录；未创建 SVG 文档时也能执行。

```text
dir
[DIR]  docs
[DIR]  plugins
[FILE] demo.svg
```

命令不接收参数，插件不接收 options。只列出直接子项，包含隐藏项，排除 `.` 和 `..`，不递归、不跟随链接、不改变 cwd。read/save 关联的 SVG 路径不会成为 dir 的查询目录。

先列目录，再列普通文件，再列链接及其他特殊项；分别用 `[DIR]`、`[FILE]`、`[LINK]`、`[OTHER]`，标记后有两个空格。每组按明确字符串顺序排序，不依赖系统 locale。正常名称原样显示，含控制字符的名称转义，保证每项只占一行。

空目录输出 `(empty directory)`；读取失败报告 `error: cannot read directory: <path>`。成功和失败都不编辑 SVG、不触发内容事件，不改变 undo/redo 或保存路径。

## Adapter 的职责

| 角色 | 实现 |
| --- | --- |
| Client | 本包 DirCommand，只调用目录端口 |
| Target | 公开 API 的 DirectoryReader / DirectoryEntry |
| Adapter | 宿主已有 NodeDirectoryAdapter，将 Node 目录项转换为端口数据 |
| Adaptee | Node 的 process.cwd 和 fs.readdir |

插件不 import Node 文件系统，也不 import 宿主内部适配器；测试可直接替换 DirectoryReader。

## 安装与检查（CMD）

在项目根目录：

```cmd
npm --prefix plugins\plugin-dir install
npm run build
```

API 构建后可独立检查和测试：

```cmd
cd plugins\plugin-dir
npm run check
npm test
```

默认代码装配已启用 stats 和 dir。配置方式可单独启用本包：

```json
{
  "plugins": [
    { "module": "./plugins/plugin-dir" }
  ]
}
```

在根目录用 `npm run cli -- --config plugins.config.json` 启动。enabled:false 或从配置中移除本包，即不出现 dir 帮助，执行时报告 unknown command。
