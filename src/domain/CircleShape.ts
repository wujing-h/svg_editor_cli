// 用途：封装圆的圆心和半径，支持原子几何操作与局部恢复。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";

export class CircleShape extends Shape {
  override readonly kind = "circle";
  private cx: number;
  private cy: number;
  private r: number;

  constructor(id: string, cx: number, cy: number, r: number, styles: ShapeStyles = {}) {
    super(id, styles);
    CircleShape.validateGeometry(cx, cy, r);
    this.cx = cx;
    this.cy = cy;
    this.r = r;
  }

  override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    this.updateGeometry(this.cx + dx, this.cy + dy, this.r);
  }

  override scale(factor: number): void {
    this.validateScale(factor);
    // 圆心位置和半径同乘倍率；初始样式不属于本次几何操作。
    this.updateGeometry(this.cx * factor, this.cy * factor, this.r * factor);
  }

  override describe(): ShapeDescription {
    return {
      id: this.id, kind: this.kind,
      attributes: { cx: this.cx, cy: this.cy, r: this.r, ...this.describeStyles() },
    };
  }

  override captureGeometry(): GeometrySnapshot {
    return new GeometrySnapshot(this, { cx: this.cx, cy: this.cy, r: this.r });
  }

  override validateMoveResult(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    CircleShape.validateGeometry(this.cx + dx, this.cy + dy, this.r);
  }

  override validateScaleResult(factor: number): void {
    this.validateScale(factor);
    CircleShape.validateGeometry(this.cx * factor, this.cy * factor, this.r * factor);
  }

  override validateGeometryRestore(snapshot: GeometrySnapshot): void {
    CircleShape.validateGeometry(
      snapshot.getValue(this, "cx"), snapshot.getValue(this, "cy"), snapshot.getValue(this, "r"),
    );
  }

  override restoreGeometry(snapshot: GeometrySnapshot): void {
    this.updateGeometry(
      snapshot.getValue(this, "cx"), snapshot.getValue(this, "cy"), snapshot.getValue(this, "r"),
    );
  }

  private updateGeometry(cx: number, cy: number, r: number): void {
    CircleShape.validateGeometry(cx, cy, r);
    this.cx = cx;
    this.cy = cy;
    this.r = r;
  }

  private static validateGeometry(cx: number, cy: number, r: number): void {
    if (![cx, cy, r].every(Number.isFinite)) {
      throw new Error("geometry values must be finite");
    }
    if (r < 0) {
      throw new Error("circle radius must be non-negative");
    }
  }
}
