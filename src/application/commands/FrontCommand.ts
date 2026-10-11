// 用途：将图形移到同级绘制顺序末尾，使其位于最前层。
import type { PlacementChange } from "../../domain/PlacementChange.js";
import type { SubtreeLocation } from "../../domain/SubtreeLocation.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { PlacementCommand } from "../PlacementCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class FrontCommand extends PlacementCommand {
  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super(document, tokens);
  }

  protected override changePlacement(): PlacementChange {
    this.arguments.requireCount(1, 1, "front <id>");
    return this.document.bringToFront(this.arguments.stringAt(0));
  }

  protected override appliedResult(location: SubtreeLocation): CommandResult {
    return { summary: { template: "{kind}#{id} moved to front", values: { kind: location.shape.kind, id: location.shape.id } } };
  }
}
