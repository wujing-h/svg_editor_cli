# stats 插件

通过 `pj/plugin-api` 注册只读统计命令，独立于内置命令实现，不依赖其他插件。

```text
stats
rect: 3  circle: 1  text: 2  (total 6, containers 2)
```

命令不接收参数，需要先 `init` 或 `read`。插件不接收 options。

按当前画布子节点顺序深度优先遍历，叶子类型按首次出现顺序排列。容器通过描述中的 children 字段识别，包括空容器和第三方复合容器；根 SVG 不计数，容器内部叶子正常计数。逻辑叶子类型使用 type，缺省使用 kind。查询不修改内容、不进入历史，也不发布编辑事件。

## 安装与构建（CMD）

在项目根目录先安装根依赖和插件开发依赖：

```cmd
npm install
npm --prefix plugins\plugin-stats install
npm run build
```

根构建按“公开 API → 独立插件 → CLI”顺序执行，避免首次构建时缺少 API 声明或插件构建物。公开 API 阶段输出声明，CLI 阶段仅输出 JavaScript，避免覆盖插件已引用的宿主声明。插件的本地开发依赖 pj 指向仓库根包，生产环境通过 peerDependency 使用宿主提供的 API。

API 构建完成后，插件可独立检查和测试：

```cmd
cd plugins\plugin-stats
npm run check
npm test
```

独立测试只使用注册与内容查询替身，不加载宿主或其他插件。

## 装配

代码方式由顶层 `EditorBootstrap` 导入本包默认实例及本包 package.json，交给统一加载器激活。默认启动已启用 stats。

配置方式在项目根的配置文件中声明：

```json
{
  "plugins": [
    { "module": "./plugins/plugin-stats" }
  ]
}
```

```cmd
npm run cli -- --config plugins.config.json
```

显式配置只启用配置中的可选插件；空数组或 `enabled: false` 禁用 stats，help 不显示该命令，执行时报告 unknown command。配置模块路径相对于配置文件所在目录。
