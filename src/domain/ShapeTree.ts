// 用途：只读检查完整子树的身份、父子关系与容器规则，供离线构造和文档接入共用。
import type { Shape } from "./Shape.js";

export class ShapeTree {
  static collect(root: Shape): readonly Shape[] {
    const nodes: Shape[] = [];
    const seen = new Set<Shape>();
    const ids = new Set<string>();
    const visit = (shape: Shape): void => {
      if (seen.has(shape)) {
        throw new Error("shape tree contains a cycle or repeated node");
      }
      if (ids.has(shape.id)) {
        throw new Error(`id already exists: ${shape.id}`);
      }
      seen.add(shape);
      ids.add(shape.id);
      nodes.push(shape);
      const children = shape.children;
      if (shape.isContainer()) {
        shape.validateChildren(children);
      } else if (children.length !== 0) {
        throw new Error(`not a container: ${shape.id}`);
      }
      for (const child of children) {
        if (child.parent !== shape) {
          throw new Error("inconsistent parent and child references");
        }
        visit(child);
      }
    };
    visit(root);
    return nodes;
  }
}
