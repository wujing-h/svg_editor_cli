// 用途：定义图形的身份、统一几何操作与局部恢复契约。
import type { GeometrySnapshot } from "./GeometrySnapshot.js";
import type { ShapeDescription } from "./ShapeDescription.js";
import type { GroupShape } from "./GroupShape.js";
import type { SvgDocument } from "./SvgDocument.js";
import type { ShapeStyles } from "./ShapeStyles.js";
import { treeMutationToken } from "./internal/TreeMutationToken.js";

export abstract class Shape {
  private readonly identifier: string;
  private parentShape: GroupShape | undefined;
  private ownerDocument: SvgDocument | undefined;
  private readonly fillValue: string | undefined;
  private readonly strokeValue: string | undefined;
  private readonly strokeWidthValue: number | undefined;
  abstract readonly kind: string;

  protected constructor(id: string, styles: ShapeStyles = {}) {
    if (id.length === 0) {
      throw new Error("shape id must not be empty");
    }
    if (styles.strokeWidth !== undefined && (!Number.isFinite(styles.strokeWidth) || styles.strokeWidth < 0)) {
      throw new Error("stroke width must be finite and non-negative");
    }
    this.identifier = id;
    this.fillValue = styles.fill;
    this.strokeValue = styles.stroke;
    this.strokeWidthValue = styles.strokeWidth;
  }

  get id(): string {
    return this.identifier;
  }

  get parent(): GroupShape | undefined {
    return this.parentShape;
  }

  get document(): SvgDocument | undefined {
    return this.ownerDocument;
  }

  get children(): readonly Shape[] {
    return [];
  }

  isContainer(): this is GroupShape {
    return false;
  }

  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract describe(): ShapeDescription;
  abstract captureGeometry(): GeometrySnapshot;
  abstract restoreGeometry(snapshot: GeometrySnapshot): void;
  // 容器先通过这些方法检查全部子孙，再开始写入几何状态。
  abstract validateMoveResult(dx: number, dy: number): void;
  abstract validateScaleResult(factor: number): void;
  abstract validateGeometryRestore(snapshot: GeometrySnapshot): void;

  /** @internal 只供 SvgDocument 在完整结构校验后更新归属。 */
  setTreeContext(
    token: typeof treeMutationToken,
    parent: GroupShape | undefined,
    document: SvgDocument | undefined,
  ): void {
    if (token !== treeMutationToken) {
      throw new Error("tree structure must be changed through SvgDocument");
    }
    this.parentShape = parent;
    this.ownerDocument = document;
  }

  protected validateMove(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new Error("move offsets must be finite");
    }
  }

  protected describeStyles(): Record<string, string | number> {
    const attributes: Record<string, string | number> = {};
    // 未设置就不输出，保留 SVG 自身的默认值和容器样式继承语义。
    if (this.fillValue !== undefined) {
      attributes.fill = this.fillValue;
    }
    if (this.strokeValue !== undefined) {
      attributes.stroke = this.strokeValue;
    }
    if (this.strokeWidthValue !== undefined) {
      attributes["stroke-width"] = this.strokeWidthValue;
    }
    return attributes;
  }

  protected validateScale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error("scale factor must be positive");
    }
  }
}
