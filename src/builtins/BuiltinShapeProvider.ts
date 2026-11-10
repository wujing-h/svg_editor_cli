// 用途：按一种内置图形的声明解析参数和 SVG 属性，保留原有校验及默认值规则。
import type { Shape } from "../domain/Shape.js";
import type { ShapeStyles } from "../domain/ShapeStyles.js";
import type { ShapeProvider, ShapeAttributes, SvgShapeInput } from "../domain/ShapeProvider.js";

export interface BuiltinShapeDefinition {
  readonly geometry: readonly string[];
  readonly syntax: string;
  readonly paint?: "fill" | "stroke";
  readonly requiresText?: boolean;
  readonly pairedRadii?: readonly [string, string];
  readonly build: (id: string, readNumber: (name: string) => number, styles: ShapeStyles, readText: () => string) => Shape;
}

export class BuiltinShapeProvider implements ShapeProvider {
  readonly name: string;
  private readonly definition: BuiltinShapeDefinition;

  constructor(name: string, definition: BuiltinShapeDefinition) {
    this.name = name;
    this.definition = definition;
  }

  create(id: string, attributes: ShapeAttributes = {}, text?: string): Shape {
    const definition = this.definition;
    const allowed = new Set([...definition.geometry, "fill", "stroke", "stroke-width", "font-size", "text-anchor"]);
    for (const name of Object.keys(attributes)) {
      if (!allowed.has(name)) {
        throw new Error(`unknown attribute: ${name}`);
      }
    }
    if (!definition.requiresText && text !== undefined) {
      throw new Error("text content is only supported by text shapes");
    }
    return definition.build(id, (name) => this.number(attributes, name), this.styles(attributes), () => this.requireText(text));
  }

  createFromSvg(input: SvgShapeInput): Shape {
    const { id, tagName: kind, attributes, text: content } = input;
    if (input.children.length !== 0) {
      throw new Error("complete SVG subtree construction is not configured");
    }
    const definition = this.definition;
    const normalized: Record<string, string | number> = { ...attributes };
    // SVG 2 的椭圆只有一个半径时，另一半径使用相同长度；同时省略时为零。
    if (definition.pairedRadii !== undefined) {
      const [first, second] = definition.pairedRadii;
      for (const [name, other] of [[first, second], [second, first]] as const) {
        if (attributes[name] === undefined || attributes[name] === "auto") {
          const value = attributes[other];
          normalized[name] = value === undefined || value === "auto" ? 0 : value;
        }
      }
    }
    for (const name of definition.geometry) {
      const raw = normalized[name] ?? 0;
      normalized[name] = typeof raw === "string" ? raw.trim().replace(/px$/, "") : raw;
    }
    const strokeWidth = normalized["stroke-width"];
    if (typeof strokeWidth === "string") {
      normalized["stroke-width"] = strokeWidth.trim().replace(/px$/, "");
    }
    if (!definition.requiresText && content.trim() !== "") {
      throw new Error(`unexpected text content in <${kind}>`);
    }
    // 提供者负责默认几何与内容语义，SvgReader 不按图形标签分派。
    return this.create(id, normalized, definition.requiresText ? content : undefined);
  }

  createFromParameters(id: string, parameters: readonly string[]): Shape {
    const definition = this.definition;
    const required = definition.geometry.length + (definition.requiresText ? 1 : 0);
    const maximum = required + (definition.paint === undefined ? 0 : 1);
    if (parameters.length < required || parameters.length > maximum) {
      throw new Error(`usage: ${definition.syntax}`);
    }

    const attributes: Record<string, string | number> = {};
    for (const [index, name] of definition.geometry.entries()) {
      attributes[name] = this.parameter(parameters, index, definition.syntax);
    }
    const text = definition.requiresText
      ? this.parameter(parameters, definition.geometry.length, definition.syntax)
      : undefined;
    const paint = parameters[required];
    if (definition.paint !== undefined && paint !== undefined) {
      attributes[definition.paint] = paint;
    }
    // 两种输入共享创建与校验；in 子句和文档接入由应用层负责。
    return this.create(id, attributes, text);
  }

  private parameter(parameters: readonly string[], index: number, syntax: string): string {
    const value = parameters[index];
    if (value === undefined) {
      throw new Error(`usage: ${syntax}`);
    }
    return value;
  }

  private number(attributes: ShapeAttributes, name: string): number {
    const raw = attributes[name];
    if (raw === undefined) {
      throw new Error(`missing geometry attribute: ${name}`);
    }
    if (typeof raw !== "number" && typeof raw !== "string") {
      throw new Error(`invalid number: ${raw}`);
    }
    // 不接受空字符串、带单位或十六进制；数值范围再由具体图形校验。
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const value = Number(raw);
    if ((typeof raw === "string" && !decimal.test(raw)) || !Number.isFinite(value)) {
      throw new Error(`invalid number: ${raw}`);
    }
    return value;
  }

  private styles(attributes: ShapeAttributes): ShapeStyles {
    const styles: { fill?: string; stroke?: string; strokeWidth?: number; fontSize?: string; textAnchor?: string } = {};
    for (const name of ["fill", "stroke"] as const) {
      const value = attributes[name];
      if (value !== undefined) {
        if (typeof value !== "string") {
          throw new Error(`invalid paint value: ${name}`);
        }
        styles[name] = value;
      }
    }
    if (attributes["stroke-width"] !== undefined) {
      styles.strokeWidth = this.number(attributes, "stroke-width");
    }
    const fontSize = attributes["font-size"];
    if (fontSize !== undefined) {
      if (typeof fontSize !== "string" || fontSize.trim() === "") {
        throw new Error("invalid font-size");
      }
      // 保留 SVG/CSS 原始表示，几何缩放不改写这个只读展示属性。
      styles.fontSize = fontSize;
    }
    const textAnchor = attributes["text-anchor"];
    if (textAnchor !== undefined) {
      if (typeof textAnchor !== "string" || !["start", "middle", "end", "inherit"].includes(textAnchor)) {
        throw new Error("invalid text-anchor");
      }
      styles.textAnchor = textAnchor;
    }
    return styles;
  }

  private requireText(text: string | undefined): string {
    if (typeof text !== "string") {
      throw new Error("text content is required");
    }
    return text;
  }
}
