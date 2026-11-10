// 用途：校验 undo 参数并请求会话撤销一个编辑单元。
import { CommandArguments } from "../../application/CommandArguments.js";
import { EditorSession } from "../../application/EditorSession.js";
import type { Command } from "../../application/contracts/Command.js";
import type { CommandResult } from "../../application/contracts/CommandResult.js";
import type { CommandToken } from "../../application/contracts/CommandToken.js";

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
