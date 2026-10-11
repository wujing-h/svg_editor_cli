// 用途：记录子树的文档、对象、父容器与位置，供删除或换位的局部恢复使用。
import type { GroupShape } from "./GroupShape.js";
import type { Shape } from "./Shape.js";
import type { SvgDocument } from "./SvgDocument.js";

export interface SubtreeLocation {
  readonly document: SvgDocument;
  readonly shape: Shape;
  readonly parent: GroupShape | undefined;
  readonly index: number;
}
