// 用途：严格解析限定范围的 SVG，预留全部显式 id 后补全匿名元素并构造独立文档。
import { DOMParser, onWarningStopParsing } from "@xmldom/xmldom";
import type { Document, Element, Node } from "@xmldom/xmldom";
import type { DocumentReadResult } from "../application/contracts/DocumentReadResult.js";
import { ShapeFactory } from "../domain/ShapeFactory.js";
import { SvgDocument } from "../domain/SvgDocument.js";

export class SvgReader {
  private readonly factory: ShapeFactory;

  constructor(factory: ShapeFactory = new ShapeFactory()) {
    this.factory = factory;
  }

  parse(source: string): DocumentReadResult {
    this.validateCharacters(source);
    const parser = new DOMParser({
      // XML 解析器的恢复性 warning 也视为失败，不能修补坏 XML 后宣称读入成功。
      onError: onWarningStopParsing,
      normalizeLineEndings: (value) => value.replace(/\r\n?/g, "\n"),
    });
    let xml: Document;
    try {
      xml = parser.parseFromString(source, "application/xml");
    } catch (error: unknown) {
      throw new Error(`invalid SVG XML: ${error instanceof Error ? error.message : String(error)}`);
    }
    const root = xml.documentElement;
    if (root === null || root.localName !== "svg") {
      throw new Error("SVG root element must be <svg>");
    }
    if (root.namespaceURI !== null && root.namespaceURI !== "http://www.w3.org/2000/svg") {
      throw new Error("unsupported SVG namespace");
    }
    for (const node of xml.childNodes) {
      if (node === root || node.nodeType === node.COMMENT_NODE) {
        continue;
      }
      if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE && node.nodeName === "xml") {
        const declaration = node.nodeValue ?? "";
        const encoding = /\bencoding\s*=\s*(["'])(.*?)\1/.exec(declaration)?.[2];
        if (encoding !== undefined && !/^utf-?8$/i.test(encoding)) {
          throw new Error("SVG input must use UTF-8 encoding");
        }
        continue;
      }
      if (node.nodeType === node.TEXT_NODE && (node.nodeValue ?? "").trim() === "") {
        continue;
      }
      throw new Error(`unsupported XML node outside SVG root: ${node.nodeName}`);
    }

    const canvas = this.canvasSize(this.attributesOf(root));
    const document = new SvgDocument(canvas.width, canvas.height);
    const elements: Element[] = [];
    const collect = (element: Element): void => {
      for (const child of this.childElements(element)) {
        if (child.namespaceURI !== root.namespaceURI) {
          throw new Error(`unsupported SVG namespace on <${child.tagName}>`);
        }
        elements.push(child);
        collect(child);
      }
    };
    collect(root);

    // 先预留整个文件的显式 id，匿名元素不能抢占尚未遍历到的命名。
    const usedIds = new Set<string>();
    const ids = new Map<Element, string>();
    for (const element of elements) {
      const id = element.getAttribute("id");
      if (id !== null && id !== "") {
        if (usedIds.has(id)) {
          throw new Error(`id already exists: ${id}`);
        }
        this.validateCharacters(id);
        usedIds.add(id);
        ids.set(element, id);
      }
    }
    const warnings: { kind: string; id: string }[] = [];
    const counters = new Map<string, number>();
    for (const element of elements) {
      if (!ids.has(element)) {
        const kind = element.localName ?? element.tagName;
        let number = counters.get(kind) ?? 1;
        while (usedIds.has(`${kind}${number}`)) {
          number += 1;
        }
        const id = `${kind}${number}`;
        counters.set(kind, number + 1);
        usedIds.add(id);
        ids.set(element, id);
        warnings.push({ kind, id });
      }
    }
    const build = (element: Element, parentId?: string): void => {
      const id = ids.get(element);
      if (id === undefined) {
        throw new Error("missing assigned SVG id");
      }
      const attributes = this.attributesOf(element);
      delete attributes.id;
      const text = this.directText(element);
      const shape = this.factory.createFromSvg(element.localName ?? element.tagName, id, attributes, text);
      const children = this.childElements(element);
      if (children.length !== 0 && !shape.isContainer()) {
        throw new Error(`unsupported child elements in <${shape.kind}>`);
      }
      document.insert(shape, parentId);
      for (const child of children) {
        build(child, shape.id);
      }
    };
    if (this.directText(root).trim() !== "") {
      throw new Error("unexpected text content in <svg>");
    }
    for (const child of this.childElements(root)) {
      build(child);
    }
    return { document, elementCount: elements.length, warnings };
  }

  private attributesOf(element: Element): Record<string, string> {
    const attributes: Record<string, string> = Object.create(null) as Record<string, string>;
    for (let index = 0; index < element.attributes.length; index += 1) {
      const attribute = element.attributes.item(index);
      if (attribute === null || attribute.namespaceURI === "http://www.w3.org/2000/xmlns/") {
        continue;
      }
      if (attribute.namespaceURI !== null) {
        throw new Error(`unsupported SVG attribute: ${attribute.name}`);
      }
      this.validateCharacters(attribute.value);
      attributes[attribute.name] = attribute.value;
    }
    return attributes;
  }

  private childElements(node: Node): readonly Element[] {
    return [...node.childNodes].filter((child) => child.nodeType === child.ELEMENT_NODE) as Element[];
  }

  private directText(node: Node): string {
    let text = "";
    for (const child of node.childNodes) {
      if (child.nodeType === child.TEXT_NODE || child.nodeType === child.CDATA_SECTION_NODE) {
        this.validateCharacters(child.nodeValue ?? "");
        text += child.nodeValue ?? "";
      } else if (child.nodeType !== child.ELEMENT_NODE && child.nodeType !== child.COMMENT_NODE) {
        throw new Error(`unsupported XML node inside SVG: ${child.nodeName}`);
      }
    }
    return text;
  }

  private canvasSize(attributes: Readonly<Record<string, string>>): { width: number; height: number } {
    const allowed = new Set(["width", "height", "viewBox"]);
    for (const name of Object.keys(attributes)) {
      if (!allowed.has(name)) {
        throw new Error(`unsupported SVG root attribute: ${name}`);
      }
    }
    let box: readonly number[] | undefined;
    if (attributes.viewBox !== undefined) {
      const values = attributes.viewBox.trim().split(/[\s,]+/);
      if (values.length !== 4) {
        throw new Error("invalid SVG viewBox");
      }
      box = values.map((value) => this.lengthValue(value, "viewBox", false));
      if (box[0] !== 0 || box[1] !== 0) {
        throw new Error("unsupported SVG viewBox: origin must be (0,0)");
      }
    }
    const width = attributes.width === undefined ? box?.[2] : this.lengthValue(attributes.width, "width");
    const height = attributes.height === undefined ? box?.[3] : this.lengthValue(attributes.height, "height");
    if (width === undefined || height === undefined) {
      throw new Error("SVG requires width and height or a viewBox");
    }
    if (box !== undefined && (box[2] !== width || box[3] !== height)) {
      throw new Error("unsupported SVG viewBox: size must match canvas");
    }
    return { width, height };
  }

  private lengthValue(raw: string, name: string, allowPixels = true): number {
    const value = allowPixels ? raw.trim().replace(/px$/, "") : raw.trim();
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (!decimal.test(value) || !Number.isFinite(Number(value))) {
      throw new Error(`invalid SVG length: ${name}`);
    }
    return Number(value);
  }

  private validateCharacters(value: string): void {
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/u.test(value)) {
      throw new Error("invalid XML character in SVG content");
    }
  }
}
