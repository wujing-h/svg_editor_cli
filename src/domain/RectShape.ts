// 用途：封装矩形几何，支持原子移动、缩放以及准确的局部恢复。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";

export class RectShape extends Shape {
  override readonly kind = "rect";
  private x: number;
  private y: number;
  private width: number;
  private height: number;

  constructor(id: string, x: number, y: number, width: number, height: number, styles: ShapeStyles = {}) {
    super(id, styles);
    RectShape.validateGeometry(x, y, width, height);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    this.updateGeometry(this.x + dx, this.y + dy, this.width, this.height);
  }

  override scale(factor: number): void {
    this.validateScale(factor);
    // 课程要求位置与尺寸一起缩放，而不是只改变宽高。
    this.updateGeometry(
      this.x * factor,
      this.y * factor,
      this.width * factor,
      this.height * factor,
    );
  }

  override describe(): ShapeDescription {
    return {
      id: this.id,
      kind: this.kind,
      position: { x: this.x, y: this.y },
      geometry: { x: this.x, y: this.y, width: this.width, height: this.height },
      attributes: {
        x: this.x, y: this.y, width: this.width, height: this.height,
        ...this.describeStyles(),
      },
    };
  }

  override captureGeometry(): GeometrySnapshot {
    return new GeometrySnapshot(this, {
      x: this.x, y: this.y, width: this.width, height: this.height,
    });
  }

  override validateMoveResult(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    RectShape.validateGeometry(this.x + dx, this.y + dy, this.width, this.height);
  }

  override validateScaleResult(factor: number): void {
    this.validateScale(factor);
    RectShape.validateGeometry(
      this.x * factor, this.y * factor, this.width * factor, this.height * factor,
    );
  }

  override validateGeometryRestore(snapshot: GeometrySnapshot): void {
    RectShape.validateGeometry(
      snapshot.getValue(this, "x"), snapshot.getValue(this, "y"),
      snapshot.getValue(this, "width"), snapshot.getValue(this, "height"),
    );
  }

  override restoreGeometry(snapshot: GeometrySnapshot): void {
    const x = snapshot.getValue(this, "x");
    const y = snapshot.getValue(this, "y");
    const width = snapshot.getValue(this, "width");
    const height = snapshot.getValue(this, "height");
    // 恢复保存的值，避免通过反向位移或倒数缩放积累浮点误差。
    this.updateGeometry(x, y, width, height);
  }

  private updateGeometry(x: number, y: number, width: number, height: number): void {
    // 包括计算结果在内，全部校验后再写入，防止数值溢出留下部分修改。
    RectShape.validateGeometry(x, y, width, height);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  private static validateGeometry(x: number, y: number, width: number, height: number): void {
    // 新建、几何操作和属性修改共用相同的范围约束。
    if (![x, y, width, height].every(Number.isFinite)) {
      throw new Error("geometry values must be finite");
    }
    if (width < 0 || height < 0) {
      throw new Error("rectangle dimensions must be non-negative");
    }
  }

  protected override getOwnAttribute(attribute: string): number {
    return this.geometryAttribute(attribute, { x: this.x, y: this.y, width: this.width, height: this.height });
  }

  protected override setOwnAttribute(attribute: string, raw: string | number): void {
    this.getOwnAttribute(attribute);
    const value = this.numberAttribute(raw);
    this.updateGeometry(
      attribute === "x" ? value : this.x,
      attribute === "y" ? value : this.y,
      attribute === "width" ? value : this.width,
      attribute === "height" ? value : this.height,
    );
  }
}
