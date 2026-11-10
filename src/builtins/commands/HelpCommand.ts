// 用途：读取已注册命令的帮助信息，新增命令无需维护固定帮助列表。
import type { Command } from "../../application/contracts/Command.js";
import type { CommandResult } from "../../application/contracts/CommandResult.js";
import type { CommandToken } from "../../application/contracts/CommandToken.js";
import type { PluginContext } from "../../application/contracts/PluginContext.js";

export class HelpCommand implements Command {
  private readonly arguments: readonly CommandToken[];
  private readonly getHelp: PluginContext["getCommandHelp"];

  constructor(arguments_: readonly CommandToken[], getHelp: PluginContext["getCommandHelp"]) {
    this.arguments = arguments_;
    this.getHelp = getHelp;
  }

  execute(): CommandResult {
    if (this.arguments.length !== 0) {
      throw new Error("usage: help");
    }
    return { help: this.getHelp() };
  }
}
