// 用途：描述一个受影响父容器的子节点顺序，根级节点以 undefined 表示父容器。
import type { GroupShape } from "./GroupShape.js";
import type { Shape } from "./Shape.js";

export interface SiblingOrder {
  readonly parent: GroupShape | undefined;
  readonly children: readonly Shape[];
}
