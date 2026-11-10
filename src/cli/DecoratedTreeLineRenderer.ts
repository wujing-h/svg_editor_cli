// 用途：包装同一树行接口并追加单行标签，隔离违规标签而保留内层输出。
import type { TreeDecorator, TreeLineContext } from "../application/contracts/TreeDecorator.js";
import type { TreeLineRenderer } from "./TreeLineRenderer.js";

export class DecoratedTreeLineRenderer implements TreeLineRenderer {
  private readonly inner: TreeLineRenderer;
  private readonly decorator: TreeDecorator;
  private readonly reportFailure: (error: unknown) => void;
  private failed = false;

  constructor(inner: TreeLineRenderer, decorator: TreeDecorator, reportFailure: (error: unknown) => void) {
    this.inner = inner;
    this.decorator = decorator;
    this.reportFailure = reportFailure;
  }

  render(context: TreeLineContext, width = 0): string {
    const line = this.inner.render(context, width);
    if (this.failed) {
      return line;
    }
    try {
      const suffix: unknown = this.decorator.getSuffix(context);
      if (suffix === undefined) {
        return line;
      }
      if (suffix !== null && (typeof suffix === "object" || typeof suffix === "function") && "then" in suffix) {
        void Promise.resolve(suffix).catch(() => undefined);
      }
      if (typeof suffix !== "string" || /[\u0000-\u001F\u007F\u0085\u2028\u2029]/u.test(suffix)) {
        throw new Error("tree suffix must be a single-line string or undefined");
      }
      const trimmed = suffix.trim();
      return trimmed === "" ? line : `${line} ${trimmed}`;
    } catch (error: unknown) {
      this.failed = true;
      try {
        const reason = error instanceof Error ? error.message : String(error);
        this.reportFailure(new Error(`tree decorator failed: ${this.decorator.name} (${reason})`));
      } catch {
        // 报告失败不影响其他包装器、基础行或文档状态。
      }
      return line;
    }
  }
}
