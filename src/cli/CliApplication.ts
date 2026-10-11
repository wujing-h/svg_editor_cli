// 用途：运行逐行 SVG 命令终端，等待执行结果并维持统一错误输出。
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { CommandDispatcher } from "../application/CommandDispatcher.js";
import { CliFormatter } from "./CliFormatter.js";
import { CommandLineParser } from "./CommandLineParser.js";

export class CliApplication {
  private readonly dispatcher: CommandDispatcher;
  private readonly parser: CommandLineParser;
  private readonly formatter: CliFormatter;

  constructor(
    dispatcher: CommandDispatcher,
    parser: CommandLineParser,
    formatter: CliFormatter,
  ) {
    this.dispatcher = dispatcher;
    this.parser = parser;
    this.formatter = formatter;
  }

  async run(): Promise<void> {
    const interactive = stdin.isTTY === true && stdout.isTTY === true;
    const terminal = createInterface({ input: stdin, output: stdout, terminal: interactive });
    terminal.setPrompt("svg> ");
    terminal.on("SIGINT", () => terminal.close());
    stdout.write("svg-editor 0.1 - type 'help' for commands\n");

    if (interactive) {
      terminal.prompt();
    }

    try {
      // 逐条 await 取得命令，避免以后异步 read/save 与后续编辑命令交错。
      for await (const line of terminal) {
        try {
          const input = this.parser.parse(line);
          if (input !== undefined) {
            // 等待命令执行结果，避免后续命令与前序命令交错。
            const result = await this.dispatcher.dispatch(input);
            for (const output of this.formatter.format(result)) {
              stdout.write(`${output}\n`);
            }
          }
        } catch (error: unknown) {
          stdout.write(`${this.formatter.formatError(error)}\n`);
        }

        if (interactive) {
          terminal.prompt();
        }
      }
    } finally {
      terminal.close();
    }
  }
}
