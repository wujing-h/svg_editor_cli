// 用途：排版命令摘要、图形查询、属性变化与帮助内容，统一 CLI 的错误前缀。
import type { CommandResult } from "../application/contracts/CommandResult.js";
import type { ShapeView } from "../application/contracts/ShapeView.js";
import type { TreeDecorator } from "../application/contracts/TreeDecorator.js";
import { ReadonlyData } from "../application/ReadonlyData.js";
import { BaseTreeLineRenderer } from "./BaseTreeLineRenderer.js";
import { DecoratedTreeLineRenderer } from "./DecoratedTreeLineRenderer.js";
import type { TreeLineRenderer } from "./TreeLineRenderer.js";
import { ShapeText } from "./ShapeText.js";

export class CliFormatter {
  private readonly getDecorators: () => readonly TreeDecorator[];
  private readonly reportError: (error: unknown) => void;
  private readonly failedDecorators = new WeakSet<TreeDecorator>();

  constructor(getDecorators: () => readonly TreeDecorator[] = () => [], reportError: (error: unknown) => void = () => undefined) {
    this.getDecorators = getDecorators;
    this.reportError = reportError;
  }

  format(result: CommandResult): readonly string[] {
    const lines: string[] = [];
    lines.push(...(result.lines ?? []));

    for (const warning of result.warnings ?? []) {
      lines.push(`warning: assigned id ${warning.id} to unnamed <${warning.kind}>`);
    }

    if (result.tree !== undefined) {
      const { canvas, roots } = ReadonlyData.copy(result.tree);
      const renderer = this.createTreeRenderer();
      if (canvas !== undefined) {
        lines.push(renderer.render(Object.freeze({ shape: undefined, canvas })));
        this.appendTree(lines, roots, "", renderer);
      } else {
        for (const root of roots) {
          lines.push(renderer.render(Object.freeze({ shape: root, canvas: undefined })));
          this.appendTree(lines, root.children ?? [], "", renderer);
        }
      }
    }

    if (result.shapeDetails !== undefined) {
      const { shape, parent } = result.shapeDetails;
      const owner = parent === undefined ? "svg" : `${parent.kind}#${ShapeText.inlineValue(parent.id)}`;
      lines.push(`${ShapeText.label(shape)}  parent=${owner}`);
      const geometry = ShapeText.attributeList(shape.geometry ?? {});
      if (geometry !== "") {
        lines.push(`  ${geometry}`);
      }
      for (const [name, value] of ShapeText.otherAttributes(shape)) {
        lines.push(`  ${name}=${ShapeText.inlineValue(value)}`);
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

  private appendTree(lines: string[], shapes: readonly ShapeView[], prefix: string, renderer: TreeLineRenderer): void {
    const width = Math.max(0, ...shapes.map((shape) => ShapeText.label(shape).length)) + 2;
    for (const [index, shape] of shapes.entries()) {
      const last = index === shapes.length - 1;
      const context = Object.freeze({ shape, canvas: undefined });
      lines.push(`${prefix}${last ? "└── " : "├── "}${renderer.render(context, width)}`);
      this.appendTree(lines, shape.children ?? [], `${prefix}${last ? "    " : "│   "}`, renderer);
    }
  }

  private createTreeRenderer(): TreeLineRenderer {
    let renderer: TreeLineRenderer = new BaseTreeLineRenderer();
    const decorators = [...this.getDecorators()].sort((left, right) =>
      left.order - right.order || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const decorator of decorators) {
      if (!this.failedDecorators.has(decorator)) {
        renderer = new DecoratedTreeLineRenderer(renderer, decorator, (error) => {
          this.failedDecorators.add(decorator);
          this.reportError(error);
        });
      }
    }
    return renderer;
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    // 错误始终占一行，避免外部错误中的换行破坏 transcript 格式。
    return `error: ${message.replace(/[\r\n]+/g, " ")}`;
  }
}
