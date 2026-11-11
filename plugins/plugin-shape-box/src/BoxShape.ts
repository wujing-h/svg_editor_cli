// 用途：以普通 g 组合矩形和标题，保护必要部件的对象身份并禁止解组。
import { GroupShape, RectShape, TextShape } from "pj/plugin-api";
import type { Shape, ShapeStyles } from "pj/plugin-api";

export class BoxShape extends GroupShape {
  private readonly rectangle: RectShape;
  private readonly label: TextShape;

  constructor(id: string, children: readonly Shape[], styles: ShapeStyles = {}) {
    // 先检查完整部件，再由基类认领 children，避免坏 SVG 产生半个复合对象。
    const rectangle = children.find((child) => child.id === `${id}-rect`);
    const label = children.find((child) => child.id === `${id}-label`);
    if (!(rectangle instanceof RectShape) || !(label instanceof TextShape)) {
      throw new Error(`invalid box components: ${id} (requires rect#${id}-rect and text#${id}-label)`);
    }
    super(id, styles, children);
    this.rectangle = rectangle;
    this.label = label;
  }

  override get type(): string {
    return "box";
  }

  override validateChildren(children: readonly Shape[]): void {
    for (const part of [this.rectangle, this.label]) {
      if (!children.includes(part)) {
        throw new Error(`required component must remain: ${part.id}`);
      }
    }
  }

  override assertCanUngroup(): void {
    throw new Error(`cannot ungroup composite shape: ${this.id}`);
  }
}
