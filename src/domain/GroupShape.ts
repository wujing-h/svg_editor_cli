// 用途：封装有序容器，通过多态递归操作子图形并保证整组几何修改原子性。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";
import { treeMutationToken } from "./internal/TreeMutationToken.js";

export class GroupShape extends Shape {
  override readonly kind = "g";
  private childShapes: Shape[] = [];

  constructor(id: string, styles: ShapeStyles = {}) {
    super(id, styles);
  }

  override get children(): readonly Shape[] {
    return [...this.childShapes];
  }

  override isContainer(): this is GroupShape {
    return true;
  }

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
