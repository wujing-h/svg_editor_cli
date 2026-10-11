// 用途：记录移除子树的原文档、父容器与位置，供局部结构恢复使用。
import type { GroupShape } from "./GroupShape.js";
import type { Shape } from "./Shape.js";
import type { SvgDocument } from "./SvgDocument.js";

export interface SubtreeLocation {
  readonly document: SvgDocument;
  readonly shape: Shape;
  readonly parent: GroupShape | undefined;
  readonly index: number;
}
