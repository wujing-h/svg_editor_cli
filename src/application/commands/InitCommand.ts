// 用途：校验 init 参数并建立默认或指定尺寸的新文档。
import { CommandArguments } from "../CommandArguments.js";
import { EditorSession } from "../EditorSession.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class InitCommand implements Command {
  private readonly session: EditorSession;
  private readonly arguments: CommandArguments;

  constructor(session: EditorSession, arguments_: readonly CommandToken[]) {
    this.session = session;
    this.arguments = new CommandArguments(arguments_);
  }

  execute(): CommandResult {
    this.arguments.requireCount(0, 2, "init [w] [h]");
    const width = this.arguments.numberAt(0, 800);
    const height = this.arguments.numberAt(1, 600);
    const size = this.session.initialize(width, height);

    return {
      summary: {
        template: "canvas {width}x{height} created",
        values: { width: size.width, height: size.height },
      },
    };
  }
}
