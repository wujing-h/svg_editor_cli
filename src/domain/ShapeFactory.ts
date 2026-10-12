// 用途：集中创建六种内置图形，共享位置参数与属性描述的类型分派。
import { CircleShape } from "./CircleShape.js";
import { EllipseShape } from "./EllipseShape.js";
import { GroupShape } from "./GroupShape.js";
import { LineShape } from "./LineShape.js";
import { RectShape } from "./RectShape.js";
import { TextShape } from "./TextShape.js";
import type { Shape } from "./Shape.js";
import type { ShapeStyles } from "./ShapeStyles.js";

type Attributes = Readonly<Record<string, string | number>>;

interface ShapeDefinition {
  readonly geometry: readonly string[];
  readonly syntax: string;
  readonly paint?: "fill" | "stroke";
  readonly requiresText?: boolean;
  readonly pairedRadii?: readonly [string, string];
  readonly build: (id: string, attributes: Attributes, styles: ShapeStyles, text?: string) => Shape;
}

export class ShapeFactory {
  // 唯一图形类型分派表；按课程要求标为待重构，首版不实现动态插件注册。
  private readonly definitions = new Map<string, ShapeDefinition>([
    ["rect", {
      geometry: ["x", "y", "width", "height"], paint: "fill",
      syntax: "create rect <id> <x> <y> <w> <h> [fill]",
      build: (id, attributes, styles) => new RectShape(
        id, this.number(attributes, "x"), this.number(attributes, "y"),
        this.number(attributes, "width"), this.number(attributes, "height"), styles,
      ),
    }],
    ["circle", {
      geometry: ["cx", "cy", "r"], paint: "fill",
      syntax: "create circle <id> <cx> <cy> <r> [fill]",
      build: (id, attributes, styles) => new CircleShape(
        id, this.number(attributes, "cx"), this.number(attributes, "cy"),
        this.number(attributes, "r"), styles,
      ),
    }],
    ["ellipse", {
      geometry: ["cx", "cy", "rx", "ry"], paint: "fill",
      pairedRadii: ["rx", "ry"],
      syntax: "create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      build: (id, attributes, styles) => new EllipseShape(
        id, this.number(attributes, "cx"), this.number(attributes, "cy"),
        this.number(attributes, "rx"), this.number(attributes, "ry"), styles,
      ),
    }],
    ["line", {
      geometry: ["x1", "y1", "x2", "y2"], paint: "stroke",
      syntax: "create line <id> <x1> <y1> <x2> <y2> [stroke]",
      build: (id, attributes, styles) => new LineShape(
        id, this.number(attributes, "x1"), this.number(attributes, "y1"),
        this.number(attributes, "x2"), this.number(attributes, "y2"), styles,
      ),
    }],
    ["text", {
      geometry: ["x", "y"], requiresText: true,
      syntax: 'create text <id> <x> <y> "content"',
      build: (id, attributes, styles, text) => new TextShape(
        id, this.number(attributes, "x"), this.number(attributes, "y"),
        this.requireText(text), styles,
      ),
    }],
    ["g", {
      geometry: [], syntax: "create g <id>",
      build: (id, _attributes, styles) => new GroupShape(id, styles),
    }],
  ]);

  create(kind: string, id: string, attributes: Attributes = {}, text?: string): Shape {
    const definition = this.findDefinition(kind);
    const allowed = new Set([...definition.geometry, "fill", "stroke", "stroke-width", "font-size", "text-anchor"]);
    for (const name of Object.keys(attributes)) {
      if (!allowed.has(name)) {
        throw new Error(`unknown attribute: ${name}`);
      }
    }
    if (!definition.requiresText && text !== undefined) {
      throw new Error("text content is only supported by text shapes");
    }
    return definition.build(id, attributes, this.styles(attributes), text);
  }

  createFromSvg(kind: string, id: string, attributes: Attributes, content: string): Shape {
    const definition = this.findDefinition(kind);
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
    // 类型识别、默认几何与内容语义仍集中在工厂，不让 SvgReader 再按标签分派。
    return this.create(kind, id, normalized, definition.requiresText ? content : undefined);
  }

  createFromParameters(kind: string, id: string, parameters: readonly string[]): Shape {
    const definition = this.findDefinition(kind);
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
    return this.create(kind, id, attributes, text);
  }

  private findDefinition(kind: string): ShapeDefinition {
    const definition = this.definitions.get(kind);
    if (definition === undefined) {
      throw new Error(`unknown shape type: ${kind} (is the plugin loaded?)`);
    }
    return definition;
  }

  private parameter(parameters: readonly string[], index: number, syntax: string): string {
    const value = parameters[index];
    if (value === undefined) {
      throw new Error(`usage: ${syntax}`);
    }
    return value;
  }

  private number(attributes: Attributes, name: string): number {
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

  private styles(attributes: Attributes): ShapeStyles {
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
