// 用途：封装文字坐标与原始内容，几何操作保留文本并支持局部恢复。
import { GeometrySnapshot } from "./GeometrySnapshot.js";
import { Shape } from "./Shape.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { ShapeStyles } from "./ShapeStyles.js";

export class TextShape extends Shape {
  override readonly kind = "text";
  private x: number;
  private y: number;
  private readonly content: string;

  constructor(id: string, x: number, y: number, content: string, styles: ShapeStyles = {}) {
    super(id, styles);
    TextShape.validateGeometry(x, y);
    this.x = x;
    this.y = y;
    this.content = content;
  }

  override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    this.updateGeometry(this.x + dx, this.y + dy);
  }

  override scale(factor: number): void {
    this.validateScale(factor);
    this.updateGeometry(this.x * factor, this.y * factor);
  }

  override describe(): ShapeDescription {
    // 内容属于子文本，保留原值；XML 转义由未来的 SvgWriter 负责。
    return {
      id: this.id, kind: this.kind,
      position: { x: this.x, y: this.y },
      attributes: { x: this.x, y: this.y, ...this.describeStyles() },
      text: this.content,
    };
  }

  override captureGeometry(): GeometrySnapshot {
    return new GeometrySnapshot(this, { x: this.x, y: this.y });
  }

  override validateMoveResult(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    TextShape.validateGeometry(this.x + dx, this.y + dy);
  }

  override validateScaleResult(factor: number): void {
    this.validateScale(factor);
    TextShape.validateGeometry(this.x * factor, this.y * factor);
  }

  override validateGeometryRestore(snapshot: GeometrySnapshot): void {
    TextShape.validateGeometry(snapshot.getValue(this, "x"), snapshot.getValue(this, "y"));
  }

  override restoreGeometry(snapshot: GeometrySnapshot): void {
    this.updateGeometry(snapshot.getValue(this, "x"), snapshot.getValue(this, "y"));
  }

  private updateGeometry(x: number, y: number): void {
    TextShape.validateGeometry(x, y);
    this.x = x;
    this.y = y;
  }

  private static validateGeometry(x: number, y: number): void {
    if (![x, y].every(Number.isFinite)) {
      throw new Error("geometry values must be finite");
    }
  }
}
