// 用途：解析逐行 CLI 输入，保留双引号文本并正确区分注释与颜色。
import type { CommandInput } from "../application/contracts/CommandInput.js";
import type { CommandToken } from "../application/contracts/CommandToken.js";

export class CommandLineParser {
  parse(line: string): CommandInput | undefined {
    const input = line.trim();
    if (input.length === 0 || input.startsWith("#")) {
      return undefined;
    }

    const tokens: CommandToken[] = [];
    let index = 0;

    while (index < input.length) {
      if (/\s/.test(input.charAt(index))) {
        index += 1;
        continue;
      }

      const quoted = input.charAt(index) === '"';
      let value = "";

      if (quoted) {
        index += 1;
        let closed = false;

        while (index < input.length) {
          const character = input.charAt(index);
          const next = input.charAt(index + 1);

          // 只解释引号和反斜杠的转义，保留 Windows 路径中的其他反斜杠。
          if (character === "\\" && (next === '"' || next === "\\")) {
            value += next;
            index += 2;
          } else if (character === '"') {
            index += 1;
            closed = true;
            break;
          } else {
            value += character;
            index += 1;
          }
        }

        if (!closed) {
          throw new Error("unterminated quoted argument");
        }
        if (index < input.length && !/\s/.test(input.charAt(index))) {
          throw new Error("expected whitespace after quoted argument");
        }
      } else {
        while (index < input.length && !/\s/.test(input.charAt(index))) {
          const character = input.charAt(index);
          if (character === '"') {
            throw new Error("quoted argument must start with a double quote");
          }
          value += character;
          index += 1;
        }
      }

      tokens.push({ value, quoted });
    }

    const name = tokens[0];
    if (name === undefined || name.quoted) {
      throw new Error("command name must not be quoted");
    }

    return { name: name.value, arguments: tokens.slice(1) };
  }
}
