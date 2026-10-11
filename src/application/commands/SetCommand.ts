// 用途：通过统一图形接口修改一个属性，保存原值和缺失状态以支持撤销重做。
import type { AttributeSnapshot } from "../../domain/AttributeSnapshot.js";
import type { Shape } from "../../domain/Shape.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class SetCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;
  private shape: Shape | undefined;
  private before: AttributeSnapshot | undefined;
  private after: AttributeSnapshot | undefined;

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  override execute(): CommandResult {
    this.arguments.requireCount(3, 3, "set <id> <attr> <value>");
    const shape = this.document.findShape(this.arguments.stringAt(0));
    const attribute = this.arguments.stringAt(1);
    // 捕获原值同时检查属性是否受支持；数值解析和范围校验由对象负责。
    const before = shape.captureAttribute(attribute);
    shape.setAttribute(attribute, this.arguments.stringAt(2));
    this.shape = shape;
    this.before = before;
    this.after = shape.captureAttribute(attribute);
    return this.result(shape, this.after);
  }

  override undo(): CommandResult {
    if (this.before === undefined) {
      throw new Error("set command has not been executed");
    }
    const shape = this.requireShape();
    // 原属性缺失时恢复缺失，不写入默认颜色或零宽度。
    shape.restoreAttribute(this.before);
    return this.result(shape, this.before);
  }

  override redo(): CommandResult {
    if (this.after === undefined) {
      throw new Error("set command has not been executed");
    }
    const shape = this.requireShape();
    shape.restoreAttribute(this.after);
    return this.result(shape, this.after);
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

  private result(shape: Shape, snapshot: AttributeSnapshot): CommandResult {
    return {
      attributeChange: {
        kind: shape.kind, id: shape.id, attribute: snapshot.attribute, value: snapshot.getValue(shape),
      },
    };
  }
}
