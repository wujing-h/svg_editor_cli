// 用途：集中将命令名转换为命令对象，并通过统一接口执行。
import { HelpCommand } from "./commands/HelpCommand.js";
import { InitCommand } from "./commands/InitCommand.js";
import { CanvasCommand } from "./commands/CanvasCommand.js";
import { CreateCommand } from "./commands/CreateCommand.js";
import { MoveCommand } from "./commands/MoveCommand.js";
import { ScaleCommand } from "./commands/ScaleCommand.js";
import { DeleteCommand } from "./commands/DeleteCommand.js";
import { SetCommand } from "./commands/SetCommand.js";
import { AddToCommand } from "./commands/AddToCommand.js";
import { FrontCommand } from "./commands/FrontCommand.js";
import { BackCommand } from "./commands/BackCommand.js";
import { GroupCommand } from "./commands/GroupCommand.js";
import { UngroupCommand } from "./commands/UngroupCommand.js";
import { UndoCommand } from "./commands/UndoCommand.js";
import { RedoCommand } from "./commands/RedoCommand.js";
import { ShapeFactory } from "../domain/ShapeFactory.js";
import { EditorSession } from "./EditorSession.js";
import type { Command } from "./contracts/Command.js";
import type { CommandInput } from "./contracts/CommandInput.js";
import type { CommandResult } from "./contracts/CommandResult.js";

export class CommandDispatcher {
  private readonly session: EditorSession;
  private readonly factory = new ShapeFactory();

  constructor(session: EditorSession) {
    this.session = session;
  }

  async dispatch(input: CommandInput): Promise<CommandResult> {
    // 创建命令对象并执行命令，等待返回
    const command = this.createCommand(input);
    return await this.session.execute(command);
  }

  private createCommand(input: CommandInput): Command {
    // 作业允许的命令名分派入口；后续注册机制的待重构点集中在这里。
    switch (input.name) {
      case "init":
        return new InitCommand(this.session, input.arguments);
      case "canvas":
        return new CanvasCommand(this.session, input.arguments);
      case "create":
        return new CreateCommand(this.session.requireDocument(), this.factory, input.arguments);
      case "move":
        return new MoveCommand(this.session.requireDocument(), input.arguments);
      case "scale":
        return new ScaleCommand(this.session.requireDocument(), input.arguments);
      case "delete":
        return new DeleteCommand(this.session.requireDocument(), input.arguments);
      case "set":
        return new SetCommand(this.session.requireDocument(), input.arguments);
      case "addto":
        return new AddToCommand(this.session.requireDocument(), input.arguments);
      case "front":
        return new FrontCommand(this.session.requireDocument(), input.arguments);
      case "back":
        return new BackCommand(this.session.requireDocument(), input.arguments);
      case "group":
        return new GroupCommand(this.session.requireDocument(), this.factory, input.arguments);
      case "ungroup":
        return new UngroupCommand(this.session.requireDocument(), input.arguments);
      case "undo":
        return new UndoCommand(this.session, input.arguments);
      case "redo":
        return new RedoCommand(this.session, input.arguments);
      case "help":
        return new HelpCommand(input.arguments);
      default:
        throw new Error(`unknown command: ${input.name}`);
    }
  }
}
