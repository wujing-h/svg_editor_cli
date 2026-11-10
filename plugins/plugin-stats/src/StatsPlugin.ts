// 用途：注册 stats 的命令元数据与构造入口，不依赖内置命令表或其他插件。
import type { EditorServices, Plugin, PluginContext } from "pj/plugin-api";
import { StatsCommand } from "./StatsCommand.js";

// 统计只需要命令注册和内容查询，不依赖可变文档或宿主其他能力。
type StatsContext = {
  readonly services: { readonly editor: Pick<EditorServices["editor"], "getSnapshot"> };
  readonly registerCommand: PluginContext["registerCommand"];
};

export class StatsPlugin implements Plugin {
  activate(context: StatsContext, options?: unknown): void {
    if (options !== undefined) {
      throw new Error("stats plugin does not accept options");
    }
    context.registerCommand({
      name: "stats", syntax: "stats", description: "count leaf shapes by type and containers in depth-first order",
      create: (tokens) => new StatsCommand(context.services.editor, tokens),
    });
  }
}
