// 用途：向插件提供公开文档查询和目录访问服务，不暴露宿主装配对象。
import type { CanvasSize } from "../../domain/CanvasSize.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import type { DirectoryReader } from "./DirectoryReader.js";

export interface EditorServices {
  readonly editor: {
    requireDocument(): SvgDocument;
    getCanvasSize(): CanvasSize;
  };
  readonly directory: DirectoryReader;
}
