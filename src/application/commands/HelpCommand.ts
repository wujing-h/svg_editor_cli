// 用途：提供当前 CLI 已支持命令的语法与说明。
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class HelpCommand implements Command {
  private readonly arguments: readonly CommandToken[];

  constructor(arguments_: readonly CommandToken[]) {
    this.arguments = arguments_;
  }

  execute(): CommandResult {
    if (this.arguments.length !== 0) {
      throw new Error("usage: help");
    }

    return {
      help: [
        { syntax: "init [w] [h]", description: "create a canvas (default 800x600)" },
        { syntax: "canvas [w] [h]", description: "show or resize the current canvas" },
        { syntax: "create <type> <id> [params...] [in <containerId>]", description: "create rect/circle/ellipse/line/text/g" },
        { syntax: "move <id> <dx> <dy>", description: "move a shape or all descendants of a group" },
        { syntax: "scale <id> <factor>", description: "scale all geometry by a positive factor" },
        { syntax: "delete <id>", description: "delete a shape and all its descendants" },
        { syntax: "set <id> <attr> <value>", description: "set a supported geometry, style, or text property" },
        { syntax: "undo", description: "undo the last edit" },
        { syntax: "redo", description: "redo the last undone edit" },
        { syntax: "help", description: "show available commands" },
      ],
    };
  }
}
