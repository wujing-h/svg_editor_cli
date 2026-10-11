// 用途：管理编辑历史，仅在执行或恢复成功后更新 undo/redo 栈。
import type { EditCommand } from "./EditCommand.js";
import type { CommandResult } from "./contracts/CommandResult.js";

export class CommandHistory {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private blockedByIo = false;

  execute(command: EditCommand): CommandResult {
    const result = command.execute();
    // 失败不会走到这里，因此保留原历史和 IO 限制。
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.blockedByIo = false;
    return result;
  }

  undo(): CommandResult {
    this.requireAllowed();
    const command = this.undoStack.at(-1);
    if (command === undefined) {
      throw new Error("nothing to undo");
    }
    // 先恢复再转移栈顶；恢复失败时还能再次尝试。
    const result = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return result;
  }

  redo(): CommandResult {
    this.requireAllowed();
    const command = this.redoStack.at(-1);
    if (command === undefined) {
      throw new Error("nothing to redo");
    }
    const result = command.redo();
    this.redoStack.pop();
    this.undoStack.push(command);
    return result;
  }

  resetAfterIo(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.blockedByIo = true;
  }

  private requireAllowed(): void {
    if (this.blockedByIo) {
      throw new Error("undo not allowed after io command");
    }
  }
}
