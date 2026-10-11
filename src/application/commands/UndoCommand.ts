// 用途：校验 undo 参数并请求会话撤销一个编辑单元。
import { CommandArguments } from "../CommandArguments.js";
import { EditorSession } from "../EditorSession.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class UndoCommand implements Command {
  private readonly session: EditorSession;
  private readonly arguments: CommandArguments;

  constructor(session: EditorSession, tokens: readonly CommandToken[]) {
    this.session = session;
    this.arguments = new CommandArguments(tokens);
  }

  execute(): CommandResult {
    this.arguments.requireCount(0, 0, "undo");
    return this.session.undo();
  }
}
