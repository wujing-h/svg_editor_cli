// 用途：将只读文档描述序列化为独立 SVG，保留顺序并转义 XML 属性与文本。
import type { ShapeDescription } from "../domain/ShapeDescription.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export class SvgWriter {
  serialize(document: SvgDocument): { readonly content: string; readonly elementCount: number } {
    const { width, height } = document.getCanvasSize();
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ];
    let elementCount = 0;
    for (const shape of document.getRootShapes()) {
      elementCount += this.appendShape(lines, shape.describe(), 1);
    }
    lines.push("</svg>");
    return { content: `${lines.join("\n")}\n`, elementCount };
  }

  private appendShape(lines: string[], shape: ShapeDescription, depth: number): number {
    this.validateName(shape.kind);
    const attributes = [`id="${this.escapeAttribute(shape.id)}"`];
    for (const [name, value] of Object.entries(shape.attributes)) {
      this.validateName(name);
      attributes.push(`${name}="${this.escapeAttribute(String(value))}"`);
    }
    const opening = `${"  ".repeat(depth)}<${shape.kind} ${attributes.join(" ")}`;
    const children = shape.children ?? [];
    if (shape.text !== undefined) {
      if (children.length !== 0) {
        throw new Error("SVG shape cannot contain both text and child shapes");
      }
      // 文本紧接起止标签，不能用缩进或额外换行改变用户的内容。
      lines.push(`${opening}>${this.escapeText(shape.text)}</${shape.kind}>`);
      return 1;
    }
    if (children.length === 0) {
      lines.push(`${opening}/>`);
      return 1;
    }
    lines.push(`${opening}>`);
    let count = 1;
    for (const child of children) {
      count += this.appendShape(lines, child, depth + 1);
    }
    lines.push(`${"  ".repeat(depth)}</${shape.kind}>`);
    return count;
  }

  private escapeAttribute(value: string): string {
    const escapes: Readonly<Record<string, string>> = {
      '"': "&quot;", "'": "&apos;", "\t": "&#9;", "\n": "&#10;",
    };
    // 属性中的空白使用字符引用，避免 XML 读取时把它们规范化为空格。
    return this.escapeText(value).replace(/["'\t\n]/g, (character) => escapes[character] ?? character);
  }

  private escapeText(value: string): string {
    // XML 1.0 不允许部分控制字符及未配对代理字符；必须在写文件前拒绝。
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(value)) {
      throw new Error("invalid XML character in SVG content");
    }
    const escapes: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\r": "&#13;" };
    return value.replace(/[&<>\r]/g, (character) => escapes[character] ?? character);
  }

  private validateName(name: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) {
      throw new Error(`invalid SVG name: ${name}`);
    }
  }
}
