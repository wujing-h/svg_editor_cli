// 用途：定义统一命令执行接口，兼容同步编辑与异步文件操作。
import type { CommandResult } from "./CommandResult.js";

export interface Command {
  execute(): CommandResult | Promise<CommandResult>;
}
