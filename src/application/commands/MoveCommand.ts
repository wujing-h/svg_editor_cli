// 用途：委派统一图形移动，保存前后局部几何以准确撤销和重做。
import type { GeometrySnapshot } from "../../domain/GeometrySnapshot.js";
import type { Shape } from "../../domain/Shape.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class MoveCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;
  private shape: Shape | undefined;
  private before: GeometrySnapshot | undefined;
  private after: GeometrySnapshot | undefined;
  private movedResult: CommandResult | undefined;
  private restoredResult: CommandResult | undefined;

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  override execute(): CommandResult {
    this.arguments.requireCount(3, 3, "move <id> <dx> <dy>");
    const shape = this.document.findShape(this.arguments.stringAt(0));
    const dx = this.arguments.numberAt(1, 0);
    const dy = this.arguments.numberAt(2, 0);
    shape.validateMoveResult(dx, dy);
    const before = shape.captureGeometry();
    const restoredResult = this.result(shape, true, dx, dy);
    shape.move(dx, dy);
    this.shape = shape;
    this.before = before;
    this.after = shape.captureGeometry();
    this.restoredResult = restoredResult;
    this.movedResult = this.result(shape, false, dx, dy);
    return this.movedResult;
  }

  override undo(): CommandResult {
    if (this.before === undefined || this.restoredResult === undefined) {
      throw new Error("move command has not been executed");
    }
    this.requireShape().restoreGeometry(this.before);
    return this.restoredResult;
  }

  override redo(): CommandResult {
    if (this.after === undefined || this.movedResult === undefined) {
      throw new Error("move command has not been executed");
    }
    // 恢复保存值，避免重复执行增量操作造成浮点误差。
    this.requireShape().restoreGeometry(this.after);
    return this.movedResult;
  }

  private requireShape(): Shape {
    const shape = this.shape;
    if (shape === undefined) {
      throw new Error("move command has not been executed");
    }
    if (this.document.findShape(shape.id) !== shape) {
      throw new Error("move target is no longer in this document");
    }
    return shape;
  }

  private result(shape: Shape, restoring: boolean, dx: number, dy: number): CommandResult {
    const position = shape.describe().position;
    if (position !== undefined) {
      return {
        summary: {
          template: restoring ? "{kind}#{id} moved back to ({x},{y})" : "{kind}#{id} moved to ({x},{y})",
          values: { kind: shape.kind, id: shape.id, x: position.x, y: position.y },
        },
      };
    }
    return {
      summary: {
        template: restoring ? "{kind}#{id} move undone" : "{kind}#{id} moved by ({dx},{dy})",
        values: { kind: shape.kind, id: shape.id, dx, dy },
      },
    };
  }
}
