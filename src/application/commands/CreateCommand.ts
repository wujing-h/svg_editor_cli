// 用途：创建图形并保存对象及原位置，供撤销移除和重做接回。
import type { Shape } from "../../domain/Shape.js";
import { ShapeFactory } from "../../domain/ShapeFactory.js";
import type { SubtreeLocation } from "../../domain/SubtreeLocation.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class CreateCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly factory: ShapeFactory;
  private readonly tokens: readonly CommandToken[];
  private shape: Shape | undefined;
  private location: SubtreeLocation | undefined;

  constructor(document: SvgDocument, factory: ShapeFactory, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.factory = factory;
    this.tokens = [...tokens];
  }

  override execute(): CommandResult {
    const syntax = "create <type> <id> [params...] [in <containerId>]";
    const arguments_ = new CommandArguments(this.tokens);
    arguments_.requireCount(2, Infinity, syntax);
    const parameters = this.tokens.slice(2);
    let parentId: string | undefined;
    const marker = parameters.at(-2);
    // 只解析未加引号的尾缀关键字；文本内容 "in" 不会被误吞。
    if (marker?.value === "in" && !marker.quoted) {
      parentId = parameters.pop()?.value;
      parameters.pop();
    } else {
      const last = parameters.at(-1);
      if (last?.value === "in" && !last.quoted) {
        throw new Error(`usage: ${syntax}`);
      }
    }

    const shape = this.factory.createFromParameters(
      arguments_.stringAt(0), arguments_.stringAt(1), parameters.map((token) => token.value),
    );
    this.document.insert(shape, parentId);
    this.shape = shape;
    return this.createdResult(shape);
  }

  override undo(): CommandResult {
    const shape = this.requireShape();
    if (this.document.findShape(shape.id) !== shape) {
      throw new Error("create target is no longer in this document");
    }
    this.location = this.document.remove(shape.id);
    return { summary: { template: "{kind}#{id} deleted", values: { kind: shape.kind, id: shape.id } } };
  }

  override redo(): CommandResult {
    if (this.location === undefined) {
      throw new Error("create command has not been undone");
    }
    // 恢复同一对象和原索引，不重新创建，也不默认追加到末尾。
    this.document.restore(this.location);
    return this.createdResult(this.requireShape());
  }

  private requireShape(): Shape {
    if (this.shape === undefined) {
      throw new Error("create command has not been executed");
    }
    return this.shape;
  }

  private createdResult(shape: Shape): CommandResult {
    const parent = shape.parent;
    return {
      summary: {
        template: parent === undefined ? "{kind}#{id} created" : "{kind}#{id} created in g#{parent}",
        values: { kind: shape.kind, id: shape.id, parent: parent?.id ?? "" },
      },
    };
  }
}
