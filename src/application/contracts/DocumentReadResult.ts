// 用途：传递已完整解析的独立文档、元素计数及待成功后输出的缺 id 警告。
import type { SvgDocument } from "../../domain/SvgDocument.js";

export interface DocumentReadResult {
  readonly document: SvgDocument;
  readonly elementCount: number;
  readonly warnings: readonly { readonly kind: string; readonly id: string }[];
}
