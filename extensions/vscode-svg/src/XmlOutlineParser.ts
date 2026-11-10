// 用途：把 XML 文本解析成带源码区间的元素树，不创建图形对象或补写 id。
import { parser as createParser } from "sax";
import type { XmlOutlineNode } from "./XmlOutlineNode.js";

interface OpenElement {
  readonly name: string;
  readonly start: number;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly children: XmlOutlineNode[];
}

export class XmlOutlineParser {
  parse(source: string, isCancelled: () => boolean = () => false): readonly XmlOutlineNode[] {
    if (isCancelled()) {
      return [];
    }

    // 每次解析使用新的栈与解析器；旧文档或失败输入不会污染编辑后的大纲。
    const roots: XmlOutlineNode[] = [];
    const stack: OpenElement[] = [];
    const options = { xmlns: true, position: true, strictEntities: true };
    const parser = createParser(true, options);
    parser.onerror = (error) => { throw error; };

    parser.onopentag = (tag) => {
      if (isCancelled()) {
        throw new Error("outline request cancelled");
      }
      // sax 的 startTagPosition 指向读完 '<' 的位置；VSCode 使用零起点 UTF-16 偏移。
      const start = parser.startTagPosition - 1;
      const selectionStart = start + 1;
      const selectionEnd = selectionStart + tag.name.length;
      if (source.slice(selectionStart, selectionEnd) !== tag.name) {
        throw new Error("invalid XML opening tag");
      }
      const attribute = tag.attributes.id;
      const id = typeof attribute === "string" ? attribute : attribute?.value;
      stack.push({
        name: id === undefined || id === "" ? tag.name : `${tag.name}#${id}`,
        start, selectionStart, selectionEnd, children: [],
      });
    };

    parser.onclosetag = () => {
      if (isCancelled()) {
        throw new Error("outline request cancelled");
      }
      const element = stack.pop();
      if (element === undefined) {
        throw new Error("unmatched XML closing tag");
      }
      // 自闭合标签也会触发 close；此时 position 同样位于最后一个 '>' 之后。
      const node: XmlOutlineNode = { ...element, end: parser.position };
      const parent = stack.at(-1);
      (parent === undefined ? roots : parent.children).push(node);
    };

    try {
      parser.write(source).close();
    } catch {
      // 编辑中的不完整或错误 XML 不展示已解析的半棵树，也不把异常抛给宿主。
      return [];
    }
    return roots.length === 1 && stack.length === 0 && !isCancelled() ? roots : [];
  }
}
