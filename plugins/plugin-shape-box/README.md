# box 图形插件

同一包注册 ShapeProvider（box）、AttributeHandler（box-attributes）与 TreeDecorator（box-type-label）。只使用 `pj/plugin-api`，不依赖其他插件。

```text
create box n1 120 100 160 60 "开始"
set n1 fill #f5a623
set n1 label "处理数据"
```

创建一个原生 g，内部为 n1-rect 和 n1-label。矩形默认填充 #4a90d9，标题位置为 x+20、y+35，与课程模板一致。create 不增加可选填充参数，fill 可通过 set 修改；程序化 create 接口允许初始 fill。

BoxShape 继承 GroupShape 的 move/scale/几何恢复，因此支持整体操作、in、嵌套、换父、分组和整体删除。必要 rect/text 的原对象必须始终保留；不能删除、移出或用普通 group 拆走它们，不能 ungroup box。可以增加其他子节点、调整顺序、直接编辑必要部件的几何或文字。结构保护只固定角色和身份，不强制重新排版。

fill 经受控属性上下文修改内部矩形，label 修改内部文字；其余支持的样式走原有白名单。一次 set 仍是一个 undo 单元，失败回滚由宿主事务负责。命令摘要复用框架通用格式，不为插件修改内核提示模板。

SVG 仍使用 `<g data-kind="box">`。读取时使用文件中完整子树的原对象和顺序，不重建模板位置或覆盖样式。必要部件缺失/类型错误则拒绝整次读取；未装插件时由框架降级为普通 g 并保留标记，届时不提供部件保护或 label 属性。

类型标签只根据逻辑 type 判断，order=100；不知道也不依赖修改星号。插件不接收 options。

## CMD

在根目录安装并构建：

```cmd
npm --prefix plugins\plugin-shape-box install
npm run build
```

公开 API 构建后可独立运行：

```cmd
npm --prefix plugins\plugin-shape-box run check
npm --prefix plugins\plugin-shape-box test
```

配置方式的 module 为 `./plugins/plugin-shape-box`，路径相对配置文件目录。
