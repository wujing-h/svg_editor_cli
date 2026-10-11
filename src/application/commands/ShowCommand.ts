// 用途：查询单个图形的属性与父容器，返回只读展示数据。
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class ShowCommand implements Command {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  execute(): CommandResult {
    this.arguments.requireCount(1, 1, "show <id>");
    const shape = this.document.findShape(this.arguments.stringAt(0));
    const parent = shape.parent;
    return { shapeDetails: {
      shape: shape.describe(),
      parent: parent === undefined ? undefined : { id: parent.id, kind: parent.kind },
    } };
  }
}
