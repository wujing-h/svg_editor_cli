// 用途：定义文档读写契约，由组装入口注入具体存储，隔离文件和 XML 实现。
import type { SvgDocument } from "../../domain/SvgDocument.js";
import type { DocumentReadResult } from "./DocumentReadResult.js";

export interface DocumentStore {
  read(filePath: string): Promise<DocumentReadResult>;
  // 返回成功保存的图形元素数量，不包含 svg 根元素。
  save(document: SvgDocument, filePath: string): Promise<number>;
}
