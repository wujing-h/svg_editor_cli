// 用途：校验命令参数数量并解析十进制数字，供具体命令复用。
import type { CommandToken } from "./contracts/CommandToken.js";

export class CommandArguments {
  private readonly tokens: readonly CommandToken[];

  constructor(tokens: readonly CommandToken[]) {
    this.tokens = tokens;
  }

  requireCount(minimum: number, maximum: number, syntax: string): void {
    if (this.tokens.length < minimum || this.tokens.length > maximum) {
      throw new Error(`usage: ${syntax}`);
    }
  }

  stringAt(index: number): string {
    const token = this.tokens[index];
    if (token === undefined) {
      throw new Error(`missing argument: ${index + 1}`);
    }
    return token.value;
  }

  numberAt(index: number, fallback: number): number {
    const token = this.tokens[index];
    if (token === undefined) {
      return fallback;
    }

    // Number() 会把空字符串和十六进制也转成数字；这里只接受十进制及科学计数法。
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const value = Number(token.value);
    if (!decimal.test(token.value) || !Number.isFinite(value)) {
      throw new Error(`invalid number: ${token.value}`);
    }
    return value;
  }
}
