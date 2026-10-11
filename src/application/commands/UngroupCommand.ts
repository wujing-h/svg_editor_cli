// 用途：解散非根级容器并提升子节点，保留原组对象和顺序以支持局部恢复。
import type { GroupingChange } from "../../domain/GroupingChange.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class UngroupCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;
  private change: GroupingChange | undefined;

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  override execute(): CommandResult {
    this.arguments.requireCount(1, 1, "ungroup <gid>");
    this.change = this.document.ungroup(this.arguments.stringAt(0));
    return this.ungroupedResult();
  }

  override undo(): CommandResult {
    const change = this.requireChange();
    this.document.restoreGrouping(change, false);
    return { summary: { template: "g#{id} restored", values: { id: change.group.id } } };
  }

  override redo(): CommandResult {
    this.document.restoreGrouping(this.requireChange(), true);
    return this.ungroupedResult();
  }

  private requireChange(): GroupingChange {
    if (this.change === undefined) {
      throw new Error("ungroup command has not been executed");
    }
    return this.change;
  }

  private ungroupedResult(): CommandResult {
    return { summary: { template: "g#{id} ungrouped", values: { id: this.requireChange().group.id } } };
  }
}
