// 用途：向插件提供公开文档查询和目录访问服务，不暴露宿主装配对象。
import type { CanvasSize } from "../../domain/CanvasSize.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import type { DirectoryReader } from "./DirectoryReader.js";
import type { DocumentSnapshot, SessionListener } from "./SessionEvent.js";
import type { PluginDisposable } from "./PluginContext.js";

export interface EditorServices {
  readonly editor: {
    requireDocument(): SvgDocument;
    getCanvasSize(): CanvasSize;
    getSnapshot(): DocumentSnapshot | undefined;
    onDidChange(listener: SessionListener): PluginDisposable;
  };
  readonly directory: DirectoryReader;
}
