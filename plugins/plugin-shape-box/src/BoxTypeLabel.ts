// 用途：为已恢复 box 语义的容器行追加类型标签，不依赖其他树标签。
import type { TreeDecorator, TreeLineContext } from "pj/plugin-api";

export class BoxTypeLabel implements TreeDecorator {
  readonly name = "box-type-label";
  readonly order = 100;

  getSuffix({ shape }: TreeLineContext): string | undefined {
    return shape?.type === "box" ? "(box)" : undefined;
  }
}
