// 用途：共享换父和同级换位的历史流程，通过文档恢复前后局部位置。
import type { PlacementChange } from "../domain/PlacementChange.js";
import type { SubtreeLocation } from "../domain/SubtreeLocation.js";
import type { SvgDocument } from "../domain/SvgDocument.js";
import { CommandArguments } from "./CommandArguments.js";
import { EditCommand } from "./EditCommand.js";
import type { CommandResult } from "./contracts/CommandResult.js";
import type { CommandToken } from "./contracts/CommandToken.js";

export abstract class PlacementCommand extends EditCommand {
  protected readonly document: SvgDocument;
  protected readonly arguments: CommandArguments;
  private change: PlacementChange | undefined;

  protected constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  protected abstract changePlacement(): PlacementChange;
  protected abstract appliedResult(location: SubtreeLocation): CommandResult;

  override execute(): CommandResult {
    const change = this.changePlacement();
    this.change = change;
    return this.appliedResult(change.after);
  }

  override undo(): CommandResult {
    const location = this.requireChange().before;
    this.document.restorePlacement(location);
    return {
      summary: {
        template: location.parent === undefined
          ? "{kind}#{id} restored to position {position} in svg"
          : "{kind}#{id} restored to position {position} in g#{parent}",
        values: {
          kind: location.shape.kind, id: location.shape.id,
          position: location.index + 1, parent: location.parent?.id ?? "",
        },
      },
    };
  }

  override redo(): CommandResult {
    const location = this.requireChange().after;
    // 恢复记录中的目标位置，不重新计算当前列表的首尾。
    this.document.restorePlacement(location);
    return this.appliedResult(location);
  }

  private requireChange(): PlacementChange {
    if (this.change === undefined) {
      throw new Error("placement command has not been executed");
    }
    return this.change;
  }
}
