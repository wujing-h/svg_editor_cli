# 手动测试指令与核对方式

完整输入见 [manual-demo.txt](../transcript/manual-demo.txt)，按已执行的四段手动测试整理，仅包含命令及分段注释。对应结果见 [manual-summary.md](manual-summary.md)，原始记录见 [manual-output.txt](manual-output.txt)。

## 启动（项目根目录 CMD）

```cmd
if not exist ai-notes\phase2\demo-output mkdir ai-notes\phase2\demo-output
npm run cli -- --config plugins.config.json
```

出现 svg> 后，按文件中的 Stage 1—4 顺序逐段粘贴命令。

| 指令段 | 代表指令 | 核对结果 |
| --- | --- | --- |
| Stage 1 基础编辑与查询 | `help`、`dir`、六种类型的 `create`、`move scene 0 10`、`scale scene 2`、`set t text "updated"`、`undo` | dir 在 init 前可用；叶子统计 5、容器 1；r.y 从 20 到 30，undo 回到 20；缩放、文本修改可撤销 |
| Stage 2 树结构 | `group pair r c`、`ungroup pair`、`undo`、`redo`、`addto other r`、`front r`、`back r`、`delete c` | 分组/解组可恢复；换父后 undo 回 scene；同级顺序变化；删除后可恢复 |
| Stage 3 box、标签和 IO | 两个 `create box`、`stats`、`save`、`set n2 fill #f5a623`、`set n2 label "处理数据 v2"`、`undo/redo`、`read` | 叶子 5、容器 3、保存 8 elements；fill/label 分别改内部矩形/文字；保存或 undo 回保存点后星号消失，(box) 保留；读回正确 |
| Stage 4 错误与历史 | `delete n1-rect`、`ungroup n1`、`scale n1 0`、读取不存在文件，然后 `redo`；成功 read 后 `undo` | 前四次失败不破坏 redo，n2-rect.y 为 110；最后一次 undo 因成功 IO 后清空历史而报错，总计 5 条预期错误 |

也可从 CMD 一次输入完整会话（需先运行上面的 mkdir，且尚未进入编辑器）：

```cmd
node dist/main.js --config plugins.config.json < doc\transcript\manual-demo.txt
```

本项手动测试中的 dir 列出项目根目录，内容随仓库文件变化。逐字节比较采用固定目录和独立的[会话对照指令](comparison/README.md)。
