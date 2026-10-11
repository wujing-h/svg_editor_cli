// 用途：将图形移到同级绘制顺序开头，使其位于最后层。
import type { PlacementChange } from "../../domain/PlacementChange.js";
import type { SubtreeLocation } from "../../domain/SubtreeLocation.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { PlacementCommand } from "../PlacementCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class BackCommand extends PlacementCommand {
  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super(document, tokens);
  }

  protected override changePlacement(): PlacementChange {
    this.arguments.requireCount(1, 1, "back <id>");
    return this.document.sendToBack(this.arguments.stringAt(0));
  }

  protected override appliedResult(location: SubtreeLocation): CommandResult {
    return { summary: { template: "{kind}#{id} moved to back", values: { kind: location.shape.kind, id: location.shape.id } } };
  }
}
