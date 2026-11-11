# 修改星号插件

注册名为 modified-star 的 TreeDecorator，order=200。每次激活创建独立状态实例，并通过可释放订阅接收成功会话事件；不依赖 box 或其他插件。

dirty 采用“当前内容与最近保存基线不同”语义：init/read 建立干净基线，save 成功更新基线；编辑/undo/redo/canvas 修改只更新当前内容，失败不更新。撤销回到保存内容后星号消失；新节点立即标星。若在已有文档上晚激活，以激活时的当前内容作为初始基线。

规范化比较包括 id、原生标签、逻辑类型、排序后的属性键值、原始文本、子节点及其顺序、父容器与同级索引、画布尺寸；不重复比较派生的 geometry/position 展示字段。内容按存储值比较，不进行视觉等价推断。

- 子节点变化会使其祖先和 SVG 根标星。
- 调整顺序或换父时，位置变化的节点也标星。
- 删除后的节点没有显示行，原父容器和根的内容变化仍可见。
- 仅改画布尺寸时，只有 SVG 根行标星。
- 没有内容变化的编辑（例如 move 0 0）不会凭操作次数标星。
- 异步 save 的已保存快照用于基线，通知时的实际当前快照另行比较。

插件返回的只有 `*` 或 undefined，拼接和异常隔离由框架负责。与 order=100 的类型标签共存时自然形成 `(box) *`，无需互相感知。插件不接收 options。

## CMD

```cmd
npm --prefix plugins\plugin-tree-star install
npm run build
npm --prefix plugins\plugin-tree-star run check
npm --prefix plugins\plugin-tree-star test
```

配置方式的 module 为 `./plugins/plugin-tree-star`。移除配置项即可恢复无星号的树；禁用全部可选插件应使用空配置。
