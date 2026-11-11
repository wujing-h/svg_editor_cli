// 用途：实例内维护保存基线和当前内容，为变化节点、祖先和 SVG 根提供星号。
import type { DocumentSnapshot, SessionEvent, TreeDecorator, TreeLineContext } from "pj/plugin-api";
import { ContentSnapshot } from "./ContentSnapshot.js";

export class ModifiedStar implements TreeDecorator {
  readonly name = "modified-star";
  readonly order = 200;
  private baseline: ContentSnapshot | undefined;
  private current: ContentSnapshot | undefined;

  constructor(initial?: DocumentSnapshot) {
    if (initial !== undefined) this.baseline = this.current = new ContentSnapshot(initial);
  }

  observe(event: SessionEvent, current: DocumentSnapshot = event.snapshot): void {
    if (event.kind === "initialize" || event.kind === "read" || event.kind === "save") {
      this.baseline = new ContentSnapshot(event.snapshot);
    }
    // save 的 snapshot 是已保存内容，当前内容可能在异步等待期间又变化。
    this.current = new ContentSnapshot(current);
  }

  getSuffix({ shape }: TreeLineContext): string | undefined {
    if (this.current === undefined) return undefined;
    if (this.baseline === undefined) return "*";
    const same = shape === undefined ? this.current.sameDocument(this.baseline) : this.current.sameShape(this.baseline, shape.id);
    return same ? undefined : "*";
  }
}
