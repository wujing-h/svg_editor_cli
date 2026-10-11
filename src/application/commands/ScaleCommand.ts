// 用途：委派统一图形缩放，保存前后局部几何以准确撤销和重做。
import type { GeometrySnapshot } from "../../domain/GeometrySnapshot.js";
import type { Shape } from "../../domain/Shape.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class ScaleCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;
  private shape: Shape | undefined;
  private before: GeometrySnapshot | undefined;
  private after: GeometrySnapshot | undefined;
  private factor: number | undefined;

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  override execute(): CommandResult {
    this.arguments.requireCount(2, 2, "scale <id> <factor>");
    const shape = this.document.findShape(this.arguments.stringAt(0));
    const factor = this.arguments.numberAt(1, 1);
    // 容器预检全部子孙，任何一项溢出时都不开始缩放。
    shape.validateScaleResult(factor);
    const before = shape.captureGeometry();
    shape.scale(factor);
    this.shape = shape;
    this.before = before;
    this.after = shape.captureGeometry();
    this.factor = factor;
    return this.scaledResult(shape, factor);
  }

  override undo(): CommandResult {
    if (this.before === undefined) {
      throw new Error("scale command has not been executed");
    }
    const shape = this.requireShape();
    shape.restoreGeometry(this.before);
    return { summary: { template: "{kind}#{id} scale undone", values: { kind: shape.kind, id: shape.id } } };
  }

  override redo(): CommandResult {
    if (this.after === undefined || this.factor === undefined) {
      throw new Error("scale command has not been executed");
    }
    const shape = this.requireShape();
    // 直接恢复缩放后的值，不通过乘法重算或用倒数撤销。
    shape.restoreGeometry(this.after);
    return this.scaledResult(shape, this.factor);
  }

  private requireShape(): Shape {
    const shape = this.shape;
    if (shape === undefined) {
      throw new Error("scale command has not been executed");
    }
    if (this.document.findShape(shape.id) !== shape) {
      throw new Error("scale target is no longer in this document");
    }
    return shape;
  }

  private scaledResult(shape: Shape, factor: number): CommandResult {
    return {
      summary: {
        template: "{kind}#{id} scaled by {factor}",
        values: { kind: shape.kind, id: shape.id, factor },
      },
    };
  }
}
