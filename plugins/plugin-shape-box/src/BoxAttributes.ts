// 用途：将 box 的 fill/label 映射到必要子部件，只经框架事务修改属性。
import type { AttributeContext, AttributeHandler, ShapeDescription } from "pj/plugin-api";

export class BoxAttributes implements AttributeHandler {
  readonly name = "box-attributes";

  handles(shape: ShapeDescription, attribute: string): boolean {
    return shape.type === "box" && (attribute === "fill" || attribute === "label");
  }

  apply(context: AttributeContext, shape: ShapeDescription, attribute: string, value: string): void {
    if (!this.handles(shape, attribute)) throw new Error(`unsupported box attribute: ${attribute}`);
    const target = `${shape.id}-${attribute === "fill" ? "rect" : "label"}`;
    const part = context.getShape(target);
    if (part.kind !== (attribute === "fill" ? "rect" : "text")) throw new Error(`invalid box component: ${target}`);
    context.setAttribute(target, attribute === "fill" ? "fill" : "text", value);
  }
}
