// 用途：生成原有 SVG 根行和图形树行，不包含任何插件标签或类型分支。
import type { TreeLineContext } from "../application/contracts/TreeDecorator.js";
import type { TreeLineRenderer } from "./TreeLineRenderer.js";
import { ShapeText } from "./ShapeText.js";

export class BaseTreeLineRenderer implements TreeLineRenderer {
  render({ shape, canvas }: TreeLineContext, width = 0): string {
    if (shape === undefined) {
      if (canvas === undefined) {
        throw new Error("tree line requires a shape or canvas");
      }
      return `svg (${canvas.width}x${canvas.height})`;
    }
    const details: string[] = [];
    const { position, endPosition } = shape;
    // 消费图形给出的语义数据，避免 CLI 再写一套图形类型分派。
    if (position !== undefined && endPosition !== undefined) {
      details.push(`(${position.x},${position.y}) -> (${endPosition.x},${endPosition.y})`);
    } else if (position !== undefined && shape.text !== undefined) {
      details.push(`(${position.x},${position.y}) ${JSON.stringify(shape.text)}`);
    } else {
      const aliases: Readonly<Record<string, string>> = { width: "w", height: "h" };
      const geometry = Object.entries(shape.geometry ?? {})
        .map(([name, value]) => `${aliases[name] ?? name}=${value}`).join(" ");
      if (geometry !== "") {
        details.push(geometry);
      }
    }
    details.push(...ShapeText.otherAttributes(shape).map(([name, value]) => `${name}=${ShapeText.inlineValue(value)}`));
    const label = ShapeText.label(shape);
    return details.length === 0 ? label : `${label.padEnd(Math.max(width, label.length + 2))}${details.join(" ")}`;
  }
}
