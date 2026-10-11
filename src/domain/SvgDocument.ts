// 用途：管理画布与有序图形树，受控维护唯一 id、父子关系及文档归属。
import type { CanvasSize } from "./CanvasSize.js";
import type { GroupShape } from "./GroupShape.js";
import type { Shape } from "./Shape.js";
import type { SubtreeLocation } from "./SubtreeLocation.js";
import { treeMutationToken } from "./internal/TreeMutationToken.js";

export class SvgDocument {
  private width: number;
  private height: number;
  private rootShapes: Shape[] = [];
  // MAP 维护 id 唯一性
  private readonly shapesById = new Map<string, Shape>();

  constructor(width: number, height: number) {
    SvgDocument.validateSize(width, height);
    this.width = width;
    this.height = height;
  }

  getCanvasSize(): CanvasSize {
    // 返回独立描述，调用方无法通过返回对象修改文档。
    return { width: this.width, height: this.height };
  }

  resizeCanvas(width: number, height: number): void {
    // 两个尺寸均通过校验后才写入，避免宽度更新而高度报错。
    SvgDocument.validateSize(width, height);
    this.width = width;
    this.height = height;
  }

  getRootShapes(): readonly Shape[] {
    return [...this.rootShapes];
  }

  findShape(id: string): Shape {
    const shape = this.shapesById.get(id);
    if (shape === undefined) {
      throw new Error(`no such shape: ${id}`);
    }
    return shape;
  }

  findContainer(id: string): GroupShape {
    const shape = this.shapesById.get(id);
    if (shape === undefined) {
      throw new Error(`no such container: ${id}`);
    }
    if (!shape.isContainer()) {
      throw new Error(`not a container: ${id}`);
    }
    return shape;
  }

  insert(shape: Shape, parentId?: string, index?: number): void {
    const parent = parentId === undefined ? undefined : this.findContainer(parentId);
    this.insertSubtree(shape, parent, index);
  }

  remove(id: string): SubtreeLocation {
    const shape = this.findShape(id);
    const parent = shape.parent;
    const siblings = parent === undefined ? this.rootShapes : [...parent.children];
    const index = siblings.indexOf(shape);
    if (index < 0) {
      throw new Error("inconsistent shape tree");
    }
    const nodes = this.collectSubtree(shape);
    const location: SubtreeLocation = { document: this, shape, parent, index };

    const remaining = siblings.filter((sibling) => sibling !== shape);
    this.replaceSiblings(parent, remaining);
    // 只清除摘下根的外部父引用；子树内部父子关系保留以供恢复。
    for (const node of nodes) {
      this.shapesById.delete(node.id);
      node.setTreeContext(treeMutationToken, node === shape ? undefined : node.parent, undefined);
    }
    return location;
  }

  restore(location: SubtreeLocation): void {
    if (location.document !== this) {
      throw new Error("subtree location belongs to another document");
    }
    const parent = location.parent;
    // 同名新容器不能替代原父对象，否则会把撤销记录恢复到错误位置。
    if (parent !== undefined && this.shapesById.get(parent.id) !== parent) {
      throw new Error(`original container is not in this document: ${parent.id}`);
    }
    this.insertSubtree(location.shape, parent, location.index);
  }

  // 插入子树
  private insertSubtree(shape: Shape, parent: GroupShape | undefined, index?: number): void {
    const siblings = parent === undefined ? this.rootShapes : [...parent.children];
    const position = index ?? siblings.length;
    // 检查插入位置合法性，避免越界或负数。
    if (!Number.isInteger(position) || position < 0 || position > siblings.length) {
      throw new Error("invalid child position");
    }

    const nodes = this.collectSubtree(shape);
    for (const node of nodes) {
      if (this.shapesById.has(node.id)) {
        throw new Error(`id already exists: ${node.id}`);
      }
      if (node.document !== undefined) {
        throw new Error(`shape already belongs to a document: ${node.id}`);
      }
    }
    if (shape.parent !== undefined) {
      throw new Error(`shape already has a parent: ${shape.id}`);
    }

    // 整棵子树与插入位置验证完成后，同步写入列表、父引用、归属与索引。
    const updated = [...siblings];
    updated.splice(position, 0, shape);
    this.replaceSiblings(parent, updated);
    for (const node of nodes) {
      // 内部父子关系保留，外部父引用更新为新父对象或 undefined。
      node.setTreeContext(treeMutationToken, node === shape ? parent : node.parent, this);
      this.shapesById.set(node.id, node);
    }
  }

  private replaceSiblings(parent: GroupShape | undefined, children: readonly Shape[]): void {
    if (parent === undefined) {
      this.rootShapes = [...children];
    } else {
      parent.replaceChildren(treeMutationToken, children);
    }
  }

  private collectSubtree(root: Shape): readonly Shape[] {
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
      if (children.length !== 0 && !shape.isContainer()) {
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

  private static validateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error("canvas dimensions must be finite and positive");
    }
  }
}
