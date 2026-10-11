// 用途：删除一个图形子树，保留原对象、父容器和顺序以支持局部恢复。
import type { Shape } from "../../domain/Shape.js";
import type { SubtreeLocation } from "../../domain/SubtreeLocation.js";
import type { SvgDocument } from "../../domain/SvgDocument.js";
import { CommandArguments } from "../CommandArguments.js";
import { EditCommand } from "../EditCommand.js";
import type { CommandResult } from "../contracts/CommandResult.js";
import type { CommandToken } from "../contracts/CommandToken.js";

export class DeleteCommand extends EditCommand {
  private readonly document: SvgDocument;
  private readonly arguments: CommandArguments;
  private location: SubtreeLocation | undefined;

  constructor(document: SvgDocument, tokens: readonly CommandToken[]) {
    super();
    this.document = document;
    this.arguments = new CommandArguments(tokens);
  }

  override execute(): CommandResult {
    this.arguments.requireCount(1, 1, "delete <id>");
    // remove 对叶子和容器使用同一入口，同时维护整棵子树的归属和索引。
    const location = this.document.remove(this.arguments.stringAt(0));
    this.location = location;
    return this.deletedResult(location.shape);
  }

  override undo(): CommandResult {
    const location = this.requireLocation();
    this.document.restore(location);
    const shape = location.shape;
    const parent = location.parent;
    return {
      summary: {
        template: parent === undefined ? "{kind}#{id} restored into svg" : "{kind}#{id} restored into g#{parent}",
        values: { kind: shape.kind, id: shape.id, parent: parent?.id ?? "" },
      },
    };
  }

  override redo(): CommandResult {
    const shape = this.requireLocation().shape;
    // 不能删除同名替代对象；恢复记录始终对应首次删除的对象和位置。
    if (this.document.findShape(shape.id) !== shape) {
      throw new Error("delete target is no longer in this document");
    }
    this.document.remove(shape.id);
    return this.deletedResult(shape);
  }

  private requireLocation(): SubtreeLocation {
    if (this.location === undefined) {
      throw new Error("delete command has not been executed");
    }
    return this.location;
  }

  private deletedResult(shape: Shape): CommandResult {
    return { summary: { template: "{kind}#{id} deleted", values: { kind: shape.kind, id: shape.id } } };
  }
}
