// 用途：排版命令摘要、图形查询、属性变化与帮助内容，统一 CLI 的错误前缀。
import type { CommandResult } from "../application/contracts/CommandResult.js";
import type { ShapeView } from "../application/contracts/ShapeView.js";

export class CliFormatter {
  format(result: CommandResult): readonly string[] {
    const lines: string[] = [];

    for (const warning of result.warnings ?? []) {
      lines.push(`warning: assigned id ${warning.id} to unnamed <${warning.kind}>`);
    }

    if (result.tree !== undefined) {
      const { canvas, roots } = result.tree;
      if (canvas !== undefined) {
        lines.push(`svg (${canvas.width}x${canvas.height})`);
        this.appendTree(lines, roots, "");
      } else {
        for (const root of roots) {
          lines.push(this.treeLine(root));
          this.appendTree(lines, root.children ?? [], "");
        }
      }
    }

    if (result.shapeDetails !== undefined) {
      const { shape, parent } = result.shapeDetails;
      const owner = parent === undefined ? "svg" : `${parent.kind}#${this.inlineValue(parent.id)}`;
      lines.push(`${this.shapeLabel(shape)}  parent=${owner}`);
      const geometry = this.attributeList(shape.geometry ?? {});
      if (geometry !== "") {
        lines.push(`  ${geometry}`);
      }
      for (const [name, value] of this.otherAttributes(shape)) {
        lines.push(`  ${name}=${this.inlineValue(value)}`);
      }
      if (shape.text !== undefined) {
        lines.push(`  text=${JSON.stringify(shape.text)}`);
      }
      if (shape.children !== undefined) {
        lines.push(`  children=${shape.children.length}`);
      }
    }

    if (result.summary !== undefined) {
      const { template, values } = result.summary;
      lines.push(template.replace(/\{(\w+)\}/g, (_match: string, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`missing result value: ${key}`);
        }
        return String(value);
      }));
    }

    if (result.help !== undefined) {
      const width = Math.max(0, ...result.help.map((entry) => entry.syntax.length));
      for (const entry of result.help) {
        lines.push(`${entry.syntax.padEnd(width)}  ${entry.description}`);
      }
    }

    if (result.attributeChange !== undefined) {
      const { kind, id, attribute, value } = result.attributeChange;
      // 引用字符串保留空格并转义换行；缺失状态与空字符串、零明确区分。
      const formatted = value === undefined ? "(unset)" : typeof value === "string" ? JSON.stringify(value) : String(value);
      lines.push(`${kind}#${id} updated: ${attribute}=${formatted}`);
    }

    return lines;
  }

  private appendTree(lines: string[], shapes: readonly ShapeView[], prefix: string): void {
    const width = Math.max(0, ...shapes.map((shape) => this.shapeLabel(shape).length)) + 2;
    for (const [index, shape] of shapes.entries()) {
      const last = index === shapes.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${this.treeLine(shape, width)}`);
      this.appendTree(lines, shape.children ?? [], `${prefix}${last ? "    " : "│   "}`);
    }
  }

  private treeLine(shape: ShapeView, width = 0): string {
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
    details.push(...this.otherAttributes(shape).map(([name, value]) => `${name}=${this.inlineValue(value)}`));
    const label = this.shapeLabel(shape);
    return details.length === 0 ? label : `${label.padEnd(Math.max(width, label.length + 2))}${details.join(" ")}`;
  }

  private otherAttributes(shape: ShapeView): readonly [string, string | number][] {
    return Object.entries(shape.attributes).filter(([name]) => !Object.hasOwn(shape.geometry ?? {}, name));
  }

  private attributeList(attributes: Readonly<Record<string, number>>): string {
    return Object.entries(attributes).map(([name, value]) => `${name}=${value}`).join(" ");
  }

  private shapeLabel(shape: ShapeView): string {
    return `${shape.kind}#${this.inlineValue(shape.id)}`;
  }

  private inlineValue(value: string | number): string {
    return typeof value === "string" && /\s/.test(value) ? JSON.stringify(value) : String(value);
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    // 错误始终占一行，避免外部错误中的换行破坏 transcript 格式。
    return `error: ${message.replace(/[\r\n]+/g, " ")}`;
  }
}
