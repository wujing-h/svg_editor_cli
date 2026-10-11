// 用途：通过工厂创建容器并收编已有图形，保存局部结构变化以撤销和重做。
import type { GroupingChange } from "../../domain/GroupingChange.js";
import type { ShapeFactory } from "../../domain/ShapeFactory.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class GroupCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly factory: ShapeFactory;
  private readonly arguments: CommandArguments;
  private readonly tokens: readonly CommandToken[];
  private change: GroupingChange | undefined;

  constructor(document: SvgDocument, factory: ShapeFactory, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.factory = factory;
    this.arguments = new CommandArguments(tokens);
    this.tokens = tokens;
  }

  override execute(): CommandResult {
    this.arguments.requireCount(2, Number.MAX_SAFE_INTEGER, "group <newGid> <id1> [id2...]");
    const group = this.factory.create("g", this.arguments.stringAt(0));
    if (!group.isContainer()) {
      throw new Error("group factory must create a container");
    }
    this.change = this.document.group(group, this.tokens.slice(1).map((token) => token.value));
    return this.groupedResult();
  }

  override undo(): CommandResult {
    const change = this.requireChange();
    this.document.restoreGrouping(change, false);
    return { summary: { template: "g#{id} grouping undone", values: { id: change.group.id } } };
  }

  override redo(): CommandResult {
    this.document.restoreGrouping(this.requireChange(), true);
    return this.groupedResult();
  }

  private requireChange(): GroupingChange {
    if (this.change === undefined) {
      throw new Error("group command has not been executed");
    }
    return this.change;
  }

  private groupedResult(): CommandResult {
    const group = this.requireChange().group;
    return { summary: {
      template: "g#{id} created with {count} children",
      values: { id: group.id, count: group.children.length },
    } };
  }
}
