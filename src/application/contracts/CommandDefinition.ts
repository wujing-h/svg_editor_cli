// 用途：定义命令注册信息，将名称、帮助文案与对象构造入口放在一起。
import type { Command } from "./Command.js";
import type { CommandToken } from "./CommandToken.js";

export interface CommandDefinition {
  readonly name: string;
  readonly syntax: string;
  readonly description: string;
  readonly create: (tokens: readonly CommandToken[]) => Command;
}
