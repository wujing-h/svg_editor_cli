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
      help: [{ syntax: "help", description: "show available commands" }],
    };
  }
}
