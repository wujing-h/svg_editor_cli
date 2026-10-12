// 用途：异步读入 SVG，返回成功摘要及缺 id 警告，历史与路径更新由会话决定。
import { CommandArguments } from "../CommandArguments.js";
import type { EditorSession } from "../EditorSession.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class ReadCommand implements Command {
  private readonly session: EditorSession;
  private readonly arguments: CommandArguments;

  constructor(session: EditorSession, tokens: readonly CommandToken[]) {
    this.session = session;
    this.arguments = new CommandArguments(tokens);
  }

  async execute(): Promise<CommandResult> {
    this.arguments.requireCount(1, 1, "read <file.svg>");
    const path = this.arguments.stringAt(0);
    const loaded = await this.session.read(path);
    return {
      warnings: loaded.warnings,
      summary: { template: "read {path} ({count} elements)", values: { path, count: loaded.elementCount } },
    };
  }
}
