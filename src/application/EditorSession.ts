// 用途：管理当前文档，协调命令执行、编辑历史与文档操作后的历史限制。
import type { CanvasSize } from "../domain/CanvasSize.js";
import { SvgDocument } from "../domain/SvgDocument.js";
import { CommandHistory } from "./CommandHistory.js";
import { EditCommand } from "./EditCommand.js";
import type { Command } from "./contracts/Command.js";
import type { CommandResult } from "./contracts/CommandResult.js";

export class EditorSession {
  private document: SvgDocument | undefined;
  private readonly history = new CommandHistory();

  execute(command: Command): CommandResult | Promise<CommandResult> {
    // 通过编辑契约识别历史行为，不按命令名再次分派。
    if (command instanceof EditCommand) {
      this.requireDocument();
      return this.history.execute(command);
    }
    return command.execute();
  }

  initialize(width: number, height: number): CanvasSize {
    // 先构造并验证新文档，失败时保留原文档。
    const document = new SvgDocument(width, height);
    this.document = document;
    this.history.resetAfterIo();
    return document.getCanvasSize();
  }

  getCanvasSize(): CanvasSize {
    return this.requireDocument().getCanvasSize();
  }

  resizeCanvas(width: number, height: number): CanvasSize {
    const document = this.requireDocument();
    document.resizeCanvas(width, height);
    this.history.resetAfterIo();
    return document.getCanvasSize();
  }

  undo(): CommandResult {
    this.requireDocument();
    return this.history.undo();
  }

  redo(): CommandResult {
    this.requireDocument();
    return this.history.redo();
  }

  // 供应用层命令取得领域对象；命令结果不向 CLI 暴露可变文档。
  requireDocument(): SvgDocument {
    if (this.document === undefined) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.document;
  }
}
