// 用途：管理当前文档，协调命令执行、编辑历史与文档操作后的历史限制。
import type { CanvasSize } from "../domain/CanvasSize.js";
import { SvgDocument } from "../domain/SvgDocument.js";
import { CommandHistory } from "./CommandHistory.js";
import { EditCommand } from "./EditCommand.js";
import type { Command } from "./contracts/Command.js";
import type { CommandResult } from "./contracts/CommandResult.js";
import type { DocumentStore } from "./contracts/DocumentStore.js";
import type { DocumentReadResult } from "./contracts/DocumentReadResult.js";

export class EditorSession {
  private document: SvgDocument | undefined;
  private readonly history = new CommandHistory();
  private readonly store: DocumentStore | undefined;
  private associatedPath: string | undefined;

  constructor(store?: DocumentStore) {
    this.store = store;
  }

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
    this.associatedPath = undefined;
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

  async save(filePath?: string): Promise<{ readonly path: string; readonly elementCount: number }> {
    const document = this.requireDocument();
    const target = filePath ?? this.associatedPath;
    if (target === undefined) {
      throw new Error("no file path. use 'save <file.svg>' first");
    }
    if (target.length === 0) {
      throw new Error("file path must not be empty");
    }
    if (this.store === undefined) {
      throw new Error("document store is not configured");
    }
    const elementCount = await this.store.save(document, target);
    // 等待完整保存成功后才更新关联路径并清空历史；失败保留全部会话状态。
    this.associatedPath = target;
    this.history.resetAfterIo();
    return { path: target, elementCount };
  }

  async read(filePath: string): Promise<DocumentReadResult> {
    if (filePath.length === 0) {
      throw new Error("file path must not be empty");
    }
    if (this.store === undefined) {
      throw new Error("document store is not configured");
    }
    const loaded = await this.store.read(filePath);
    // 独立文档完整读入后才替换会话；失败保留旧文档、关联路径和两个历史栈。
    this.document = loaded.document;
    this.associatedPath = filePath;
    this.history.resetAfterIo();
    return loaded;
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
