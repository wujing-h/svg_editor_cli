// 用途：封装图形身份与公共样式，定义统一几何、属性修改及局部恢复契约。
import { AttributeSnapshot } from "./AttributeSnapshot.js";
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
  private fillValue: string | undefined;
  private strokeValue: string | undefined;
  private strokeWidthValue: number | undefined;
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

  setAttribute(attribute: string, value: string | number): void {
    // 公共样式只修改当前对象；容器通过 SVG 继承影响外观，不覆盖子节点。
    if (attribute === "fill" || attribute === "stroke") {
      if (typeof value !== "string") {
        throw new Error(`invalid paint value: ${attribute}`);
      }
      if (attribute === "fill") {
        this.fillValue = value;
      } else {
        this.strokeValue = value;
      }
    } else if (attribute === "stroke-width") {
      const width = this.numberAttribute(value);
      if (width < 0) {
        throw new Error("stroke width must be finite and non-negative");
      }
      this.strokeWidthValue = width;
    } else {
      this.setOwnAttribute(attribute, value);
    }
  }

  captureAttribute(attribute: string): AttributeSnapshot {
    let value: string | number | undefined;
    if (attribute === "fill") {
      value = this.fillValue;
    } else if (attribute === "stroke") {
      value = this.strokeValue;
    } else if (attribute === "stroke-width") {
      value = this.strokeWidthValue;
    } else {
      value = this.getOwnAttribute(attribute);
    }
    return new AttributeSnapshot(this, attribute, value);
  }

  restoreAttribute(snapshot: AttributeSnapshot): void {
    const value = snapshot.getValue(this);
    const attribute = snapshot.attribute;
    if (value !== undefined) {
      // 原值与新值都经过对象自身的白名单和范围校验。
      this.setAttribute(attribute, value);
    } else if (attribute === "fill") {
      this.fillValue = undefined;
    } else if (attribute === "stroke") {
      this.strokeValue = undefined;
    } else if (attribute === "stroke-width") {
      this.strokeWidthValue = undefined;
    } else {
      throw new Error(`cannot remove required attribute: ${attribute}`);
    }
  }

  protected getOwnAttribute(attribute: string): string | number {
    throw new Error(`unknown attribute: ${attribute}`);
  }

  protected setOwnAttribute(attribute: string, _value: string | number): void {
    throw new Error(`unknown attribute: ${attribute}`);
  }

  protected geometryAttribute(attribute: string, values: Readonly<Record<string, number>>): number {
    const value = values[attribute];
    // 按本对象明确列出的几何字段校验，也拒绝原型链上的属性名。
    if (!Object.hasOwn(values, attribute) || typeof value !== "number") {
      throw new Error(`unknown attribute: ${attribute}`);
    }
    return value;
  }

  protected numberAttribute(raw: string | number): number {
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (typeof raw !== "number" && typeof raw !== "string") {
      throw new Error(`invalid number: ${raw}`);
    }
    const value = Number(raw);
    if ((typeof raw === "string" && !decimal.test(raw)) || !Number.isFinite(value)) {
      throw new Error(`invalid number: ${raw}`);
    }
    return value;
  }

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
