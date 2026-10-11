// 用途：将已有图形子树移入指定容器，作为最后一个子节点。
import type { PlacementChange } from "../../domain/PlacementChange.js";
import type { SubtreeLocation } from "../../domain/SubtreeLocation.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { PlacementCommand } from "../PlacementCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class AddToCommand extends PlacementCommand {
  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super(document, tokens);
  }

  protected override changePlacement(): PlacementChange {
    this.arguments.requireCount(2, 2, "addto <gid> <id>");
    return this.document.addTo(this.arguments.stringAt(0), this.arguments.stringAt(1));
  }

  protected override appliedResult(location: SubtreeLocation): CommandResult {
    return {
      summary: {
        template: "{kind}#{id} moved into g#{parent}",
        values: { kind: location.shape.kind, id: location.shape.id, parent: location.parent?.id ?? "" },
      },
    };
  }
}
