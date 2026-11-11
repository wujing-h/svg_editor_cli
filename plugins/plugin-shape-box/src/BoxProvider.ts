// 用途：解析 box 参数并离线创建模板，或从完整原生 g 子树恢复复合语义。
import { RectShape, TextShape } from "pj/plugin-api";
import type { ShapeAttributes, ShapeProvider, ShapeStyles, SvgShapeInput } from "pj/plugin-api";
import { BoxShape } from "./BoxShape.js";

export class BoxProvider implements ShapeProvider {
  readonly name = "box";

  create(id: string, attributes: ShapeAttributes = {}, text?: string): BoxShape {
    for (const name of Object.keys(attributes)) {
      if (!["x", "y", "width", "height", "fill"].includes(name)) {
        throw new Error(`unknown attribute: ${name}`);
      }
    }
    if (typeof text !== "string") {
      throw new Error("box label is required");
    }
    const x = this.number(attributes.x, "x");
    const y = this.number(attributes.y, "y");
    const width = this.number(attributes.width, "width");
    const height = this.number(attributes.height, "height");
    const fill = attributes.fill ?? "#4a90d9";
    if (typeof fill !== "string") {
      throw new Error("invalid paint value: fill");
    }
    // 模板采用作业示例的左内边距 20、基线偏移 35；移动和缩放交给 Composite。
    return new BoxShape(id, [
      new RectShape(`${id}-rect`, x, y, width, height, { fill }),
      new TextShape(`${id}-label`, x + 20, y + 35, text),
    ]);
  }

  createFromParameters(id: string, parameters: readonly string[]): BoxShape {
    if (parameters.length !== 5) {
      throw new Error('usage: create box <id> <x> <y> <w> <h> "label"');
    }
    return this.create(id, { x: parameters[0]!, y: parameters[1]!, width: parameters[2]!, height: parameters[3]! }, parameters[4]);
  }

  createFromSvg(input: SvgShapeInput): BoxShape {
    if (input.tagName !== "g" || input.attributes["data-kind"] !== this.name) {
      throw new Error("box requires <g data-kind=box>");
    }
    if (input.text.trim() !== "") {
      throw new Error("unexpected text content in box");
    }
    // 使用文件中的原对象、顺序、几何和样式，不补造缺失部件或重置模板位置。
    return new BoxShape(input.id, input.children, this.styles(input.attributes));
  }

  private number(raw: string | number | undefined, name: string, pixels = false): number {
    if (raw === undefined) {
      throw new Error(`missing geometry attribute: ${name}`);
    }
    const source = typeof raw === "string" && pixels ? raw.trim().replace(/px$/, "") : raw;
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const value = Number(source);
    if ((typeof source !== "number" && (typeof source !== "string" || !decimal.test(source))) || !Number.isFinite(value)) {
      throw new Error(`invalid number: ${raw}`);
    }
    return value;
  }

  private styles(attributes: ShapeAttributes): ShapeStyles {
    const styles: { fill?: string; stroke?: string; strokeWidth?: number; fontSize?: string; textAnchor?: string } = {};
    for (const name of Object.keys(attributes)) {
      if (!["data-kind", "fill", "stroke", "stroke-width", "font-size", "text-anchor"].includes(name)) {
        throw new Error(`unknown attribute: ${name}`);
      }
    }
    for (const name of ["fill", "stroke"] as const) {
      const value = attributes[name];
      if (value !== undefined) {
        if (typeof value !== "string") throw new Error(`invalid paint value: ${name}`);
        styles[name] = value;
      }
    }
    if (attributes["stroke-width"] !== undefined) styles.strokeWidth = this.number(attributes["stroke-width"], "stroke-width", true);
    const fontSize = attributes["font-size"];
    if (fontSize !== undefined) {
      if (typeof fontSize !== "string" || fontSize.trim() === "") throw new Error("invalid font-size");
      styles.fontSize = fontSize;
    }
    const anchor = attributes["text-anchor"];
    if (anchor !== undefined) {
      if (typeof anchor !== "string" || !["start", "middle", "end", "inherit"].includes(anchor)) throw new Error("invalid text-anchor");
      styles.textAnchor = anchor;
    }
    return styles;
  }
}
