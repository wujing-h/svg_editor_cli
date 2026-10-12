// 用途：实现 UTF-8 SVG 读写，构造独立文档并以临时文件保存，转换文件错误。
import { randomUUID } from "node:crypto";
import { open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { DocumentStore } from "../application/contracts/DocumentStore.js";
import type { DocumentReadResult } from "../application/contracts/DocumentReadResult.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { SvgWriter } from "./SvgWriter.js";
import { SvgReader } from "./SvgReader.js";

export class SvgFileStore implements DocumentStore {
  private readonly writer: SvgWriter;
  private readonly reader: SvgReader;

  constructor(writer: SvgWriter = new SvgWriter(), reader: SvgReader = new SvgReader()) {
    this.writer = writer;
    this.reader = reader;
  }

  async read(filePath: string): Promise<DocumentReadResult> {
    let source: string;
    try {
      // 禁止用替换字符掩盖非法 UTF-8 字节，否则保存时会永久改写原内容。
      source = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(filePath));
    } catch {
      throw new Error(`cannot read file: ${filePath}`);
    }
    // 格式或内容错误保留具体原因，文件错误与解析错误分别处理。
    return this.reader.parse(source);
  }

  async save(document: SvgDocument, filePath: string): Promise<number> {
    // 序列化失败时尚未接触磁盘，已有文件与会话状态均保持原样。
    const svg = this.writer.serialize(document);
    const target = resolve(filePath);
    const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
    let created = false;
    try {
      const file = await open(temporary, "wx");
      created = true;
      try {
        await file.writeFile(svg.content, "utf8");
      } finally {
        await file.close();
      }
      // 临时文件与目标位于同一目录；完整写入并关闭后才替换。
      await rename(temporary, target);
      created = false;
      return svg.elementCount;
    } catch {
      throw new Error(`cannot write file: ${filePath}`);
    } finally {
      if (created) {
        // 只清理本次以 wx 新建的临时文件，不覆盖原始写入错误。
        await unlink(temporary).catch(() => undefined);
      }
    }
  }
}
