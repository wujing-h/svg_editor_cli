# 手动测试摘要

四段手动测试结果均符合预期，原始记录见 [manual-output.txt](manual-output.txt)。批量输入产生的部分命令回显与输出粘连按原样归档。可执行指令见 [manual-demo.txt](../transcript/manual-demo.txt)，启动及逐段核对方式见 [manual-commands.md](manual-commands.md)。

| 检查 | 实际结果 |
| --- | --- |
| 基础图形与查询 | 六种内置类型组成树；stats 为 5 个叶子、1 个容器；未 init 时 dir 可用，help 包含两个新增命令 |
| Composite 与历史 | 容器移动令 r.y 从 20 到 30，undo 回到 20；缩放、文字修改、group/ungroup、addto、front/back、delete/undo 有对应结果 |
| box 与属性语义 | 两个 box 和连接线为 5 个叶子、3 个容器，保存计数 8；fill 修改内部矩形，label 修改内部文字，均可 undo/redo |
| 两个标签组合 | `(box)` 一直保留；保存后星号消失；修改子部件标记该部件及祖先；undo 回到保存内容后星号消失 |
| SVG 读写 | 保存文件含 g/rect/text/line；data-kind="box" 保留；n2 内部矩形为 #f5a623，文字为“处理数据 v2”，读回成功 |
| 失败不破坏 redo | 删除必需部件、解组 box、零倍缩放、读不存在文件被拒绝后，redo 仍成功，n2-rect.y 为 110 |
| IO 历史边界 | 成功 read 后 undo 被禁止 |

以下 5 条错误都是故意触发的校验，没有额外错误：

```text
error: required component must remain: n1-rect
error: cannot ungroup composite shape: n1
error: scale factor must be positive
error: cannot read file: ai-notes/phase2/demo-output/missing-demo.svg
error: undo not allowed after io command
```

手动测试在项目根目录运行 dir，验证目录查看功能；逐字节输出对照另用固定目录。日志中以 ai-notes 开头的路径为测试执行位置，原始输出保持不变；对应 SVG 产物归档为 [manual-review.svg](manual-review.svg)。

记录末尾包含 B 接入测试，三次 `fc /b` 均显示“找不到差异”，对应提交为 dc2691f；自动字节比较得到相同结论，结果见 [comparison/result.json](comparison/result.json)。
