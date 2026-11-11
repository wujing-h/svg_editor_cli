# 插件接入的 Git 证据

以下读取实际 Git 对象并检查路径存在性；[result.json](result.json) 保存完整提交/父提交、A 的保护目录 tree 哈希、已有插件列表及 B 的逐包数量。零字节 diff 文件表示指定保护范围确实无差异，不表示没有运行检查。

| 方式 | 接入提交 / 基线 | 差异结论 |
| --- | --- | --- |
| A stats | 4296e74 / d51203e | 新增 stats；src 仅 EditorBootstrap；保护范围为空 |
| A dir | 8c393e4 / 4296e74 | 新增 dir；src 仅 EditorBootstrap；既有 stats 不变 |
| A box + star | 426d38e / 8c393e4 | 联合接入 box 与 modified-star 两个新包；src 仅 EditorBootstrap；既有 stats/dir 不变 |
| B 四包 | dc2691f / d51203e | 相对基线新增全部四包和配置；已有 src 零变化；四包与 A 主线 fc86fcb 完全相同 |

A 的 .name-status.txt、.commit.txt、.protected.diff 分别保存原始文件清单、提交关系和排除组合根/新增包后的保护范围差异。B 对应 config-B.name-status.txt、config-B.commit.txt、config-B.src.diff、config-B.same-plugins.diff。新增目录均实际存在，B 的新包分别有 stats 8、dir 8、box 11、star 9 个跟踪文件。

## 非业务源码变化逐项说明

| 文件 | 原因 |
| --- | --- |
| package.json | 编排公开 API、独立插件和 CLI 的构建/检查/测试顺序；根依赖版本未改，package-lock.json 无变化 |
| tsconfig.plugin-api.json | 独立生成公开 API 的声明，避免跨包编译时将声明输出覆盖到输入 |
| tsconfig.json | 宿主编译时统一公开 API 类型身份，独立包及运行时仍通过真实安装的 pj/plugin-api 使用 API |
| 插件 package.json / 锁文件 / tsconfig / README / 独立测试 | 新包的依赖、贡献清单与独立构建验证，均属于新增包 |
| A 的根测试变化 | 新增集成验证及更新默认装配预期；不作为内核运行代码修改。B 不取回这些仅针对 A 默认装配的测试 |

构建配置没有加入业务分派逻辑。[config-B.metadata.patch](config-B.metadata.patch) 保存 B 的配置与构建元数据原始差异。较早的 fc86fcb 仅在插件已存在后启用配置，不能单独作为 B 接入证据；这里采用从无业务插件框架基线新增四包的 dc2691f。

## 复核命令（CMD）

```cmd
git diff --name-status 4296e74~1 4296e74
git diff --name-status 8c393e4~1 8c393e4
git diff --name-status 426d38e~1 426d38e
git diff --name-status dc2691f~1 dc2691f
git diff dc2691f~1 dc2691f -- src
git diff fc86fcb dc2691f -- plugins
git ls-tree -r --name-only dc2691f -- plugins
```

最后两条 diff 应为空，同时 ls-tree 应列出真实插件文件。A 保护范围包含全部 src（排除唯一顶层 EditorBootstrap）和既有插件（排除本次新增包），还核对 application/domain/cli/infrastructure/builtins/plugin-api 的 tree 哈希一致及 PluginLoader 的 blob 哈希不变。

PluginLoader.load/loadConfig 根据配置项 entry.module 进行通用模块解析、清单读取及 import，随后调用 PluginHost.activate；不存在业务插件名称表或具体导入分支。B 分支推送记录见 manual-output.txt，本地跟踪引用 origin/demo/config-plugins 指向 dc2691f。
