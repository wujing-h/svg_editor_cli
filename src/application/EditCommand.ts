// 用途：定义可撤销编辑的同步执行与局部恢复契约。
import type { Command } from "./contracts/Command.js";
import type { CommandResult } from "./contracts/CommandResult.js";

export abstract class EditCommand implements Command {
  // 编辑阶段保持同步；异步文件操作继续使用普通 Command。
  abstract execute(): CommandResult;
  abstract undo(): CommandResult;
  abstract redo(): CommandResult;
}
