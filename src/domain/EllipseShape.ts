// 用途：封装椭圆圆心与两轴半径，支持原子几何操作与局部恢复。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";

export class EllipseShape extends Shape {
  override readonly kind = "ellipse";
  private cx: number;
  private cy: number;
  private rx: number;
  private ry: number;

  constructor(id: string, cx: number, cy: number, rx: number, ry: number, styles: ShapeStyles = {}) {
    super(id, styles);
    EllipseShape.validateGeometry(cx, cy, rx, ry);
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = ry;
  }

  override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    this.updateGeometry(this.cx + dx, this.cy + dy, this.rx, this.ry);
  }

  override scale(factor: number): void {
    this.validateScale(factor);
    this.updateGeometry(this.cx * factor, this.cy * factor, this.rx * factor, this.ry * factor);
  }

  override describe(): ShapeDescription {
    return {
      id: this.id, kind: this.kind,
      position: { x: this.cx, y: this.cy },
      attributes: { cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry, ...this.describeStyles() },
    };
  }

  override captureGeometry(): GeometrySnapshot {
    return new GeometrySnapshot(this, { cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry });
  }

  override validateMoveResult(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    EllipseShape.validateGeometry(this.cx + dx, this.cy + dy, this.rx, this.ry);
  }

  override validateScaleResult(factor: number): void {
    this.validateScale(factor);
    EllipseShape.validateGeometry(this.cx * factor, this.cy * factor, this.rx * factor, this.ry * factor);
  }

  override validateGeometryRestore(snapshot: GeometrySnapshot): void {
    EllipseShape.validateGeometry(
      snapshot.getValue(this, "cx"), snapshot.getValue(this, "cy"),
      snapshot.getValue(this, "rx"), snapshot.getValue(this, "ry"),
    );
  }

  override restoreGeometry(snapshot: GeometrySnapshot): void {
    this.updateGeometry(
      snapshot.getValue(this, "cx"), snapshot.getValue(this, "cy"),
      snapshot.getValue(this, "rx"), snapshot.getValue(this, "ry"),
    );
  }

  private updateGeometry(cx: number, cy: number, rx: number, ry: number): void {
    EllipseShape.validateGeometry(cx, cy, rx, ry);
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = ry;
  }

  private static validateGeometry(cx: number, cy: number, rx: number, ry: number): void {
    if (![cx, cy, rx, ry].every(Number.isFinite)) {
      throw new Error("geometry values must be finite");
    }
    if (rx < 0 || ry < 0) {
      throw new Error("ellipse radii must be non-negative");
    }
  }

  protected override getOwnAttribute(attribute: string): number {
    return this.geometryAttribute(attribute, { cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry });
  }

  protected override setOwnAttribute(attribute: string, raw: string | number): void {
    this.getOwnAttribute(attribute);
    const value = this.numberAttribute(raw);
    this.updateGeometry(
      attribute === "cx" ? value : this.cx,
      attribute === "cy" ? value : this.cy,
      attribute === "rx" ? value : this.rx,
      attribute === "ry" ? value : this.ry,
    );
  }
}
