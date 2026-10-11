// 用途：保存分组或解组前后受影响的子列表，绑定原文档和组对象供局部恢复。
import type { GroupShape } from "./GroupShape.js";
import type { SiblingOrder } from "./SiblingOrder.js";
import type { SvgDocument } from "./SvgDocument.js";

export class GroupingChange {
  readonly group: GroupShape;
  private readonly document: SvgDocument;
  private readonly presentBefore: boolean;
  private readonly before: readonly SiblingOrder[];
  private readonly after: readonly SiblingOrder[];

  constructor(
    document: SvgDocument, group: GroupShape, presentBefore: boolean,
    before: readonly SiblingOrder[], after: readonly SiblingOrder[],
  ) {
    this.document = document;
    this.group = group;
    this.presentBefore = presentBefore;
    // 仅复制受影响子列表；保留原对象身份，不序列化整个文档。
    this.before = this.copyOrders(before);
    this.after = this.copyOrders(after);
  }

  isGroupPresent(after: boolean): boolean {
    return after ? !this.presentBefore : this.presentBefore;
  }

  getOrders(document: SvgDocument, after: boolean): readonly SiblingOrder[] {
    if (document !== this.document) {
      throw new Error("grouping change belongs to another document");
    }
    return this.copyOrders(after ? this.after : this.before);
  }

  private copyOrders(orders: readonly SiblingOrder[]): readonly SiblingOrder[] {
    return orders.map((order) => ({ parent: order.parent, children: [...order.children] }));
  }
}
