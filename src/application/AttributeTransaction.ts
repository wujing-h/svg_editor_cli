// 用途：受控执行一次属性编辑，合并重复字段记录并在成功或失败后关闭插件写入口。
import { AttributeChange } from "./AttributeChange.js";
import type { AttributeState } from "./AttributeChange.js";
import type { AttributeContext } from "./contracts/AttributeHandler.js";
import type { ShapeDescription } from "../domain/ShapeDescription.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class AttributeTransaction {
  readonly context: AttributeContext;
  private readonly document: SvgDocument;
  private readonly originals: AttributeState[] = [];
  private readonly recorded = new Map<Shape, Set<string>>();
  private open = true;
  private failure: { readonly error: unknown } | undefined;

  constructor(document: SvgDocument) {
    this.document = document;
    // 只交付这两个闭包，不把 commit / rollback 或可变领域对象暴露给处理器。
    this.context = Object.freeze({
      getShape: (id: string) => this.getShape(id),
      setAttribute: (id: string, attribute: string, value: string | number) => this.setAttribute(id, attribute, value),
    });
  }

  getShape(id: string): ShapeDescription {
    this.ensureOpen();
    return this.freeze(this.document.findShape(id).describe());
  }

  setAttribute(id: string, attribute: string, value: string | number): void {
    this.ensureOpen();
    if (this.failure !== undefined) {
      throw this.failure.error;
    }
    try {
      const shape = this.document.findShape(id);
      const before = shape.captureAttribute(attribute);
      const attributes = this.recorded.get(shape) ?? new Set<string>();
      if (!attributes.has(attribute)) {
        this.originals.push({ shape, snapshot: before });
        attributes.add(attribute);
        this.recorded.set(shape, attributes);
      }
      // 首次写入前已记录原值；同字段多次写入仍只保留最初值。
      shape.setAttribute(attribute, value);
    } catch (error: unknown) {
      // 处理器即使捕获错误，也不能提交此前已发生的部分修改。
      this.failure = { error };
      throw error;
    }
  }

  commit(): AttributeChange {
    this.ensureOpen();
    if (this.failure !== undefined) {
      throw this.failure.error;
    }
    const change = new AttributeChange(this.document, this.originals.map(({ shape, snapshot }) => ({
      shape, before: snapshot, after: shape.captureAttribute(snapshot.attribute),
    })));
    this.open = false;
    return change;
  }

  rollback(): void {
    this.open = false;
    AttributeChange.restoreStates(this.document, [...this.originals].reverse());
  }

  private ensureOpen(): void {
    if (!this.open) {
      throw new Error("attribute transaction is closed");
    }
  }

  private freeze<T>(value: T): T {
    // describe 返回独立描述，递归冻结只影响查询结果，不会冻结领域对象。
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) {
        this.freeze(child);
      }
      Object.freeze(value);
    }
    return value;
  }
}
