// 用途：查询当前画布，或在完整校验后修改画布尺寸。
import { CommandArguments } from "../CommandArguments.js";
import { EditorSession } from "../EditorSession.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class CanvasCommand implements Command {
  private readonly session: EditorSession;
  private readonly arguments: CommandArguments;
  private readonly query: boolean;

  constructor(session: EditorSession, arguments_: readonly CommandToken[]) {
    this.session = session;
    this.arguments = new CommandArguments(arguments_);
    this.query = arguments_.length === 0;
  }

  execute(): CommandResult {
    const current = this.session.getCanvasSize();
    this.arguments.requireCount(0, 2, "canvas [w] [h]");

    if (this.query) {
      return {
        summary: {
          template: "canvas {width}x{height}",
          values: { width: current.width, height: current.height },
        },
      };
    }

    const width = this.arguments.numberAt(0, current.width);
    const height = this.arguments.numberAt(1, current.height);
    const size = this.session.resizeCanvas(width, height);
    return {
      summary: {
        template: "canvas resized to {width}x{height}",
        values: { width: size.width, height: size.height },
      },
    };
  }
}
