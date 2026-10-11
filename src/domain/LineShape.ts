// 用途：封装线段的两个端点，支持原子几何操作与局部恢复。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";

export class LineShape extends Shape {
  override readonly kind = "line";
  private x1: number;
  private y1: number;
  private x2: number;
  private y2: number;

  constructor(id: string, x1: number, y1: number, x2: number, y2: number, styles: ShapeStyles = {}) {
    super(id, styles);
    LineShape.validateGeometry(x1, y1, x2, y2);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    // 两个端点均移动；任何一个计算结果非法都不能留下部分修改。
    this.updateGeometry(this.x1 + dx, this.y1 + dy, this.x2 + dx, this.y2 + dy);
  }

  override scale(factor: number): void {
    this.validateScale(factor);
    this.updateGeometry(this.x1 * factor, this.y1 * factor, this.x2 * factor, this.y2 * factor);
  }

  override describe(): ShapeDescription {
    return {
      id: this.id, kind: this.kind,
      attributes: { x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2, ...this.describeStyles() },
    };
  }

  override captureGeometry(): GeometrySnapshot {
    return new GeometrySnapshot(this, { x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 });
  }

  override validateMoveResult(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    LineShape.validateGeometry(this.x1 + dx, this.y1 + dy, this.x2 + dx, this.y2 + dy);
  }

  override validateScaleResult(factor: number): void {
    this.validateScale(factor);
    LineShape.validateGeometry(this.x1 * factor, this.y1 * factor, this.x2 * factor, this.y2 * factor);
  }

  override validateGeometryRestore(snapshot: GeometrySnapshot): void {
    LineShape.validateGeometry(
      snapshot.getValue(this, "x1"), snapshot.getValue(this, "y1"),
      snapshot.getValue(this, "x2"), snapshot.getValue(this, "y2"),
    );
  }

  override restoreGeometry(snapshot: GeometrySnapshot): void {
    this.updateGeometry(
      snapshot.getValue(this, "x1"), snapshot.getValue(this, "y1"),
      snapshot.getValue(this, "x2"), snapshot.getValue(this, "y2"),
    );
  }

  private updateGeometry(x1: number, y1: number, x2: number, y2: number): void {
    LineShape.validateGeometry(x1, y1, x2, y2);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  private static validateGeometry(x1: number, y1: number, x2: number, y2: number): void {
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
      throw new Error("geometry values must be finite");
    }
  }
}
