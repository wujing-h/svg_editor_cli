// 用途：集中将命令名转换为命令对象，并通过统一接口执行。
import { HelpCommand } from "./commands/HelpCommand.js";
import type { Command } from "./contracts/Command.js";
import type { CommandInput } from "./contracts/CommandInput.js";
import type { CommandResult } from "./contracts/CommandResult.js";

export class CommandDispatcher {
  async dispatch(input: CommandInput): Promise<CommandResult> {
    const command = this.createCommand(input);
    return await command.execute();
  }

  private createCommand(input: CommandInput): Command {
    // 作业允许的命令名分派入口；后续注册机制的待重构点集中在这里。
    switch (input.name) {
      case "help":
        return new HelpCommand(input.arguments);
      default:
        throw new Error(`unknown command: ${input.name}`);
    }
  }
}
