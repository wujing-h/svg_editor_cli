// 用途：注册 dir 的帮助和命令工厂，仅依赖宿主提供的目录端口。
import type { DirectoryReader, Plugin, PluginContext } from "pj/plugin-api";
import { DirCommand } from "./DirCommand.js";

type DirContext = {
  readonly services: { readonly directory: DirectoryReader };
  readonly registerCommand: PluginContext["registerCommand"];
};

export class DirPlugin implements Plugin {
  activate(context: DirContext, options?: unknown): void {
    if (options !== undefined) {
      throw new Error("dir plugin does not accept options");
    }
    context.registerCommand({
      name: "dir", syntax: "dir", description: "list direct entries in the current working directory",
      create: (tokens) => new DirCommand(context.services.directory, tokens),
    });
  }
}
