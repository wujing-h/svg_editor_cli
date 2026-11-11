// 用途：按深度优先首次出现顺序统计叶子类型，容器与根 SVG 分开计数。
import type { Command, CommandResult, CommandToken, EditorServices, ShapeDescription } from "pj/plugin-api";

export class StatsCommand implements Command {
  private readonly editor: Pick<EditorServices["editor"], "getSnapshot">;
  private readonly tokens: readonly CommandToken[];

  constructor(editor: Pick<EditorServices["editor"], "getSnapshot">, tokens: readonly CommandToken[]) {
    this.editor = editor;
    this.tokens = [...tokens];
  }

  execute(): CommandResult {
    if (this.tokens.length !== 0) {
      throw new Error("usage: stats");
    }
    const snapshot = this.editor.getSnapshot();
    if (snapshot === undefined) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    const counts = new Map<string, number>();
    let total = 0;
    let containers = 0;
    const visit = (shape: ShapeDescription): void => {
      // 容器通过 children 描述自己的结构，不枚举 g、box 或任何插件类型名。
      if (shape.children !== undefined) {
        containers += 1;
        for (const child of shape.children) {
          visit(child);
        }
      } else {
        const type = shape.type ?? shape.kind;
        counts.set(type, (counts.get(type) ?? 0) + 1);
        total += 1;
      }
    };
    for (const root of snapshot.roots) {
      visit(root);
    }
    const summary = [...counts].map(([type, count]) => `${type}: ${count}`).join("  ");
    const totals = `(total ${total}, containers ${containers})`;
    return { lines: [summary === "" ? totals : `${summary}  ${totals}`] };
  }
}
