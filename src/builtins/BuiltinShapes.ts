// 用途：把六种内置图形装配为独立提供者实例，内核工厂不再枚举类型。
import { CircleShape } from "../domain/CircleShape.js";
import { EllipseShape } from "../domain/EllipseShape.js";
import { GroupShape } from "../domain/GroupShape.js";
import { LineShape } from "../domain/LineShape.js";
import { RectShape } from "../domain/RectShape.js";
import { TextShape } from "../domain/TextShape.js";
import { BuiltinShapeProvider } from "./BuiltinShapeProvider.js";
import type { Plugin } from "../application/contracts/Plugin.js";
import type { PluginContext } from "../application/contracts/PluginContext.js";
import type { PluginManifest } from "../application/contracts/PluginManifest.js";

export class BuiltinShapes implements Plugin {
  private readonly providers = [
    new BuiltinShapeProvider("rect", {
      geometry: ["x", "y", "width", "height"], paint: "fill",
      syntax: "create rect <id> <x> <y> <w> <h> [fill]",
      build: (id, readNumber, styles) => new RectShape(
        id, readNumber("x"), readNumber("y"),
        readNumber("width"), readNumber("height"), styles,
      ),
    }),
    new BuiltinShapeProvider("circle", {
      geometry: ["cx", "cy", "r"], paint: "fill",
      syntax: "create circle <id> <cx> <cy> <r> [fill]",
      build: (id, readNumber, styles) => new CircleShape(
        id, readNumber("cx"), readNumber("cy"),
        readNumber("r"), styles,
      ),
    }),
    new BuiltinShapeProvider("ellipse", {
      geometry: ["cx", "cy", "rx", "ry"], paint: "fill",
      pairedRadii: ["rx", "ry"],
      syntax: "create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      build: (id, readNumber, styles) => new EllipseShape(
        id, readNumber("cx"), readNumber("cy"),
        readNumber("rx"), readNumber("ry"), styles,
      ),
    }),
    new BuiltinShapeProvider("line", {
      geometry: ["x1", "y1", "x2", "y2"], paint: "stroke",
      syntax: "create line <id> <x1> <y1> <x2> <y2> [stroke]",
      build: (id, readNumber, styles) => new LineShape(
        id, readNumber("x1"), readNumber("y1"),
        readNumber("x2"), readNumber("y2"), styles,
      ),
    }),
    new BuiltinShapeProvider("text", {
      geometry: ["x", "y"], requiresText: true,
      syntax: 'create text <id> <x> <y> "content"',
      build: (id, readNumber, styles, readText) => new TextShape(
        id, readNumber("x"), readNumber("y"),
        readText(), styles,
      ),
    }),
    new BuiltinShapeProvider("g", {
      geometry: [], syntax: "create g <id>", container: true,
      build: (id, _readNumber, styles, _readText, children, dataKind) => new GroupShape(id, styles, children, dataKind),
    }),
  ];

  get manifest(): PluginManifest {
    return { name: "builtin-shapes", contributes: { shapes: this.providers.map((provider) => provider.name) } };
  }

  activate(context: PluginContext): void {
    for (const provider of this.providers) {
      context.registerShape(provider);
    }
  }
}
