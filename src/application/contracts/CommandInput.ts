// 用途：定义 CLI 提交给应用层的只读命令输入。
import type { CommandToken } from "./CommandToken.js";

export interface CommandInput {
  readonly name: string;
  readonly arguments: readonly CommandToken[];
}
