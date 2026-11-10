// 用途：执行属性策略并将整批局部属性修改作为一个可撤销命令。
import { AttributeService } from "../../application/AttributeService.js";
import type { AttributeOperation } from "../../application/AttributeService.js";
import type { Shape } from "../../domain/Shape.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../../application/CommandArguments.js";
import { EditCommand } from "../../application/EditCommand.js";
import type { CommandResult } from "../../application/contracts/CommandResult.js";
import type { CommandToken } from "../../application/contracts/CommandToken.js";

export class SetCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;
  private readonly attributes: AttributeService;
  private shape: Shape | undefined;
  private operation: AttributeOperation | undefined;

  constructor(document: SvgDocument, tokens: readonly CommandToken[], attributes = new AttributeService()) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
    this.attributes = attributes;
  }

  override execute(): CommandResult {
    this.arguments.requireCount(3, 3, "set <id> <attr> <value>");
    const shape = this.document.findShape(this.arguments.stringAt(0));
    const attribute = this.arguments.stringAt(1);
    const operation = this.attributes.apply(this.document, shape, attribute, this.arguments.stringAt(2));
    this.shape = shape;
    this.operation = operation;
    return operation.afterResult;
  }

  override undo(): CommandResult {
    if (this.operation === undefined) {
      throw new Error("set command has not been executed");
    }
    this.requireShape();
    this.operation.change.restore(false);
    return this.operation.beforeResult;
  }

  override redo(): CommandResult {
    if (this.operation === undefined) {
      throw new Error("set command has not been executed");
    }
    this.requireShape();
    this.operation.change.restore(true);
    return this.operation.afterResult;
  }

  private requireShape(): Shape {
    const shape = this.shape;
    if (shape === undefined) {
      throw new Error("set command has not been executed");
    }
    if (this.document.findShape(shape.id) !== shape) {
      throw new Error("set target is no longer in this document");
    }
    return shape;
  }
}
