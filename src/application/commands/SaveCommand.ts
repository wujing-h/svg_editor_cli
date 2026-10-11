// 用途：保存当前文档到显式或关联路径，由会话在 IO 成功后更新历史。
import { CommandArguments } from "../CommandArguments.js";
import type { EditorSession } from "../EditorSession.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class SaveCommand implements Command {
  private readonly session: EditorSession;
  private readonly tokens: readonly CommandToken[];

  constructor(session: EditorSession, tokens: readonly CommandToken[]) {
    this.session = session;
    this.tokens = tokens;
  }

  async execute(): Promise<CommandResult> {
    const arguments_ = new CommandArguments(this.tokens);
    arguments_.requireCount(0, 1, "save [file.svg]");
    const path = this.tokens.length === 0 ? undefined : arguments_.stringAt(0);
    const saved = await this.session.save(path);
    return { summary: {
      template: "saved to {path} ({count} elements)",
      values: { path: saved.path, count: saved.elementCount },
    } };
  }
}
