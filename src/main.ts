// 用途：组装 CLI 的解析、分发与展示对象，并启动程序。
import { stderr } from "node:process";
import { CommandDispatcher } from "./application/CommandDispatcher.js";
import { EditorSession } from "./application/EditorSession.js";
import { CliApplication } from "./cli/CliApplication.js";
import { CliFormatter } from "./cli/CliFormatter.js";
import { CommandLineParser } from "./cli/CommandLineParser.js";

const formatter = new CliFormatter();
const application = new CliApplication(
  new CommandDispatcher(new EditorSession()),
  new CommandLineParser(),
  formatter,
);

void application.run().catch((error: unknown) => {
  stderr.write(`${formatter.formatError(error)}\n`);
  process.exitCode = 1;
});
