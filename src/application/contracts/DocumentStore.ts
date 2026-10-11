// 用途：定义文档保存契约，由组装入口注入具体存储；读取契约在 read 阶段补充。
import type { SvgDocument } from "../../domain/SvgDocument.js";

export interface DocumentStore {
  // 返回成功保存的图形元素数量，不包含 svg 根元素。
  save(document: SvgDocument, filePath: string): Promise<number>;
}
