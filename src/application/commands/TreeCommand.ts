// 用途：查询全文档或指定图形的子树，返回独立描述而不改变历史。
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import type { Command } from "../contracts/Command.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class TreeCommand implements Command {
  private readonly document: SvgDocument;
  private readonly tokens: readonly CommandToken[];

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    this.document = document;
    this.tokens = tokens;
  }

  execute(): CommandResult {
    const arguments_ = new CommandArguments(this.tokens);
    arguments_.requireCount(0, 1, "tree [id]");
    if (this.tokens.length !== 0) {
      return { tree: { roots: [this.document.findShape(arguments_.stringAt(0)).describe()] } };
    }
    return { tree: {
      canvas: this.document.getCanvasSize(),
      roots: this.document.getRootShapes().map((shape) => shape.describe()),
    } };
  }
}
