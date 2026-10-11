// 用途：排版命令摘要与帮助内容，统一 CLI 的错误前缀。
import type { CommandResult } from "../application/contracts/CommandResult.js";

export class CliFormatter {
  format(result: CommandResult): readonly string[] {
    const lines: string[] = [];

    if (result.summary !== undefined) {
      const { template, values } = result.summary;
      lines.push(template.replace(/\{(\w+)\}/g, (_match: string, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`missing result value: ${key}`);
        }
        return String(value);
      }));
    }

    if (result.help !== undefined) {
      const width = Math.max(0, ...result.help.map((entry) => entry.syntax.length));
      for (const entry of result.help) {
        lines.push(`${entry.syntax.padEnd(width)}  ${entry.description}`);
      }
    }

    return lines;
  }

  formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    // 错误始终占一行，避免外部错误中的换行破坏 transcript 格式。
    return `error: ${message.replace(/[\r\n]+/g, " ")}`;
  }
}
