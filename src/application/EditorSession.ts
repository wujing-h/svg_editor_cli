// 用途：管理当前文档，协调命令执行、编辑历史与文档操作后的历史限制。
import type { CanvasSize } from "../domain/CanvasSize.js";
import { SvgDocument } from "../domain/SvgDocument.js";
import { CommandHistory } from "./CommandHistory.js";
import { EditCommand } from "./EditCommand.js";
import type { Command } from "./contracts/Command.js";
import type { CommandResult } from "./contracts/CommandResult.js";
import type { DocumentStore } from "./contracts/DocumentStore.js";
import type { DocumentReadResult } from "./contracts/DocumentReadResult.js";
import type { DocumentSnapshot, SessionEventKind, SessionListener } from "./contracts/SessionEvent.js";
import type { PluginDisposable } from "./contracts/PluginContext.js";
import { ReadonlyData } from "./ReadonlyData.js";

export class EditorSession {
  private document: SvgDocument | undefined;
  private readonly history = new CommandHistory();
  private readonly store: DocumentStore | undefined;
  private associatedPath: string | undefined;
  private readonly listeners = new Set<{ readonly listener: SessionListener }>();
  private readonly reportError: (error: unknown) => void;

  constructor(store?: DocumentStore, reportError: (error: unknown) => void = () => undefined) {
    this.store = store;
    this.reportError = reportError;
  }

  execute(command: Command): CommandResult | Promise<CommandResult> {
    // 通过编辑契约识别历史行为，不按命令名再次分派。
    if (command instanceof EditCommand) {
      this.requireDocument();
      const result = this.history.execute(command);
      this.publish("edit");
      return result;
    }
    return command.execute();
  }

  initialize(width: number, height: number): CanvasSize {
    // 先构造并验证新文档，失败时保留原文档。
    const document = new SvgDocument(width, height);
    this.document = document;
    this.associatedPath = undefined;
    this.history.resetAfterIo();
    this.publish("initialize");
    return document.getCanvasSize();
  }

  getCanvasSize(): CanvasSize {
    return this.requireDocument().getCanvasSize();
  }

  getSnapshot(): DocumentSnapshot | undefined {
    if (this.document === undefined) {
      return undefined;
    }
    return ReadonlyData.copy({
      canvas: this.document.getCanvasSize(),
      roots: this.document.getRootShapes().map((shape) => shape.describe()),
    });
  }

  onDidChange(listener: SessionListener): PluginDisposable {
    const entry = { listener };
    this.listeners.add(entry);
    return Object.freeze({ dispose: () => { this.listeners.delete(entry); } });
  }

  resizeCanvas(width: number, height: number): CanvasSize {
    const document = this.requireDocument();
    document.resizeCanvas(width, height);
    this.history.resetAfterIo();
    this.publish("canvas");
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
    // 保存完成事件使用本次交给存储层的内容，异步等待期间的后续修改不能冒充保存基线。
    let savedSnapshot: DocumentSnapshot | undefined;
    try {
      savedSnapshot = this.getSnapshot();
    } catch (error: unknown) {
      // 观察数据构造失败不能把原本可完成的存储操作变成失败。
      this.reportListenerError(error);
    }
    const elementCount = await this.store.save(document, target);
    // 等待完整保存成功后才更新关联路径并清空历史；失败保留全部会话状态。
    this.associatedPath = target;
    this.history.resetAfterIo();
    if (savedSnapshot !== undefined) {
      this.publish("save", savedSnapshot);
    }
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
    this.publish("read");
    return loaded;
  }

  undo(): CommandResult {
    this.requireDocument();
    const result = this.history.undo();
    this.publish("undo");
    return result;
  }

  redo(): CommandResult {
    this.requireDocument();
    const result = this.history.redo();
    this.publish("redo");
    return result;
  }

  private publish(kind: SessionEventKind, snapshot?: DocumentSnapshot): void {
    if (this.listeners.size === 0) {
      return;
    }
    try {
      const content = snapshot ?? this.getSnapshot();
      if (content === undefined) {
        return;
      }
      const event = Object.freeze({ kind, snapshot: content });
      // 对订阅集合拍照，监听器增删订阅不会改变本次分发顺序。
      for (const entry of [...this.listeners]) {
        try {
          const result: unknown = entry.listener(event);
          if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
            void Promise.resolve(result).catch(() => undefined);
            throw new Error("session listeners must execute synchronously");
          }
        } catch (error: unknown) {
          this.reportListenerError(error);
        }
      }
    } catch (error: unknown) {
      // 内容描述或监听器出错时，编辑和历史已经成功，不把通知错误变成命令失败。
      this.reportListenerError(error);
    }
  }

  private reportListenerError(error: unknown): void {
    try {
      const reason = error instanceof Error ? error.message : String(error);
      this.reportError(new Error(`session listener failed: ${reason}`));
    } catch {
      // 错误报告通道自身异常，也不能破坏已完成的操作。
    }
  }

  // 供应用层命令取得领域对象；命令结果不向 CLI 暴露可变文档。
  requireDocument(): SvgDocument {
    if (this.document === undefined) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.document;
  }
}
