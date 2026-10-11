// 用途：管理当前文档，协调新建文档、画布查询与画布尺寸修改。
import type { CanvasSize } from "../domain/CanvasSize.js";
import { SvgDocument } from "../domain/SvgDocument.js";

export class EditorSession {
  private document: SvgDocument | undefined;

  initialize(width: number, height: number): CanvasSize {
    // 先构造并验证新文档，失败时保留原文档。
    const document = new SvgDocument(width, height);
    this.document = document;
    return document.getCanvasSize();
  }

  getCanvasSize(): CanvasSize {
    return this.requireDocument().getCanvasSize();
  }

  resizeCanvas(width: number, height: number): CanvasSize {
    const document = this.requireDocument();
    document.resizeCanvas(width, height);
    return document.getCanvasSize();
  }

  private requireDocument(): SvgDocument {
    if (this.document === undefined) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.document;
  }
}
