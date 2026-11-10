// 用途：封装有序容器，通过多态递归操作子图形并保证整组几何修改原子性。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import { ShapeTree } from "./ShapeTree.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";
import { treeMutationToken } from "./internal/TreeMutationToken.js";

export class GroupShape extends Shape {
  override readonly kind = "g";
  private childShapes: Shape[] = [];

  constructor(id: string, styles: ShapeStyles = {}, children: readonly Shape[] = []) {
    super(id, styles);
    const ids = new Set<string>([id]);
    for (const child of children) {
      if (child.parent !== undefined) {
        throw new Error(`shape already has a parent: ${child.id}`);
      }
      for (const node of ShapeTree.collect(child)) {
        if (ids.has(node.id)) {
          throw new Error(`id already exists: ${node.id}`);
        }
        if (node.document !== undefined) {
          throw new Error(`shape already belongs to a document: ${node.id}`);
        }
        ids.add(node.id);
      }
    }
    // 全部检查通过才认领子节点；后一个节点非法时，前面的节点仍保持游离。
    this.childShapes = [...children];
    for (const child of this.childShapes) {
      child.setTreeContext(treeMutationToken, this, undefined);
    }
    // 不在基类构造中调用自身的多态校验：此时子类字段尚未初始化。
    // 完整对象由 ShapeFactory / SvgDocument 在接入前调用 validateChildren。
  }

  override get children(): readonly Shape[] {
    return [...this.childShapes];
  }

  override isContainer(): this is GroupShape {
    return true;
  }

  // 纯校验钩子：子类可要求必要部件保留；不得在这里修改候选列表或图形。
  validateChildren(_children: readonly Shape[]): void {}

  // 普通组允许解组；复合容器可覆盖并抛错，保护整体语义。
  assertCanUngroup(): void {}

  override move(dx: number, dy: number): void {
    this.validateMoveResult(dx, dy);
    for (const child of this.childShapes) {
      child.move(dx, dy);
    }
  }

  override scale(factor: number): void {
    this.validateScaleResult(factor);
    for (const child of this.childShapes) {
      child.scale(factor);
    }
  }

  override validateMoveResult(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    // 先递归检查全部计算结果，最后一个子图形失败时也不改变前面的图形。
    for (const child of this.childShapes) {
      child.validateMoveResult(dx, dy);
    }
  }

  override validateScaleResult(factor: number): void {
    this.validateScale(factor);
    for (const child of this.childShapes) {
      child.validateScaleResult(factor);
    }
  }

  override describe(): ShapeDescription {
    return {
      id: this.id, kind: this.kind, attributes: this.describeStyles(),
      children: this.childShapes.map((child) => child.describe()),
    };
  }

  override captureGeometry(): GeometrySnapshot {
    return new GeometrySnapshot(this, {}, this.childShapes.map((child) => child.captureGeometry()));
  }

  override validateGeometryRestore(snapshot: GeometrySnapshot): void {
    const states = snapshot.getChildren(this);
    if (states.length !== this.childShapes.length) {
      throw new Error("group structure changed since geometry snapshot");
    }
    for (const [index, child] of this.childShapes.entries()) {
      const state = states[index];
      if (state === undefined) {
        throw new Error("missing child geometry snapshot");
      }
      child.validateGeometryRestore(state);
    }
  }

  override restoreGeometry(snapshot: GeometrySnapshot): void {
    this.validateGeometryRestore(snapshot);
    const states = snapshot.getChildren(this);
    for (const [index, child] of this.childShapes.entries()) {
      const state = states[index];
      if (state === undefined) {
        throw new Error("missing child geometry snapshot");
      }
      child.restoreGeometry(state);
    }
  }

  /** @internal 只供 SvgDocument 更新子列表，不向应用层提供裸数组写入口。 */
  replaceChildren(token: typeof treeMutationToken, children: readonly Shape[]): void {
    if (token !== treeMutationToken) {
      throw new Error("tree structure must be changed through SvgDocument");
    }
    this.childShapes = [...children];
  }
}
