// 用途：共用图形标签、属性和单行值格式，保持树与 show 的原有排版规则。
import type { ShapeView } from "../application/contracts/ShapeView.js";

export class ShapeText {
  static label(shape: ShapeView): string {
    return `${shape.kind}#${ShapeText.inlineValue(shape.id)}`;
  }

  static otherAttributes(shape: ShapeView): readonly [string, string | number][] {
    // 来源类型标记用于 SVG 读回，类型的可见标签由树装饰器提供。
    return Object.entries(shape.attributes).filter(([name]) => name !== "data-kind" && !Object.hasOwn(shape.geometry ?? {}, name));
  }

  static attributeList(attributes: Readonly<Record<string, number>>): string {
    return Object.entries(attributes).map(([name, value]) => `${name}=${value}`).join(" ");
  }

  static inlineValue(value: string | number): string {
    return typeof value === "string" && /\s/.test(value) ? JSON.stringify(value) : String(value);
  }
}
