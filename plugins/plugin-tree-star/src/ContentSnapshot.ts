// 用途：规范化画布、属性、子树和节点位置，封装内容比较而非记录操作次数。
import type { DocumentSnapshot, ShapeDescription } from "pj/plugin-api";

export class ContentSnapshot {
  private readonly shapes = new Map<string, string>();
  private readonly document: string;

  constructor(snapshot: DocumentSnapshot) {
    const visit = (shape: ShapeDescription, parent: string | undefined, index: number): unknown => {
      const attributes = Object.keys(shape.attributes).sort().map((name) => [name, shape.attributes[name]]);
      const children = shape.children?.map((child, position) => visit(child, shape.id, position));
      // 几何与位置来自 attributes；不重复比较派生的 geometry / position 展示字段。
      const value = [shape.id, shape.kind, shape.type ?? shape.kind, attributes, shape.text ?? null, children ?? null];
      this.shapes.set(shape.id, JSON.stringify([parent ?? null, index, value]));
      return value;
    };
    const roots = snapshot.roots.map((shape, index) => visit(shape, undefined, index));
    this.document = JSON.stringify([snapshot.canvas.width, snapshot.canvas.height, roots]);
  }

  sameDocument(other: ContentSnapshot): boolean {
    return this.document === other.document;
  }

  sameShape(other: ContentSnapshot, id: string): boolean {
    return this.shapes.has(id) && this.shapes.get(id) === other.shapes.get(id);
  }
}
