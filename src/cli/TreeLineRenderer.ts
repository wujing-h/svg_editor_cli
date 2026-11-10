// 用途：统一基础树行和包装树行的渲染接口，缩进与连接线由调用者管理。
import type { TreeLineContext } from "../application/contracts/TreeDecorator.js";

export interface TreeLineRenderer {
  render(context: TreeLineContext, width?: number): string;
}
