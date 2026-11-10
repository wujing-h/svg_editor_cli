// 用途：组装 CLI 的解析、分发与展示对象，并启动程序。
import { stderr } from "node:process";
import { CommandDispatcher } from "./application/CommandDispatcher.js";
import { EditorSession } from "./application/EditorSession.js";
import { PluginHost } from "./application/PluginHost.js";
import { BuiltinCommands } from "./builtins/BuiltinCommands.js";
import { CliApplication } from "./cli/CliApplication.js";
import { CliFormatter } from "./cli/CliFormatter.js";
import { CommandLineParser } from "./cli/CommandLineParser.js";
import { SvgFileStore } from "./infrastructure/SvgFileStore.js";
import { NodeDirectoryAdapter } from "./infrastructure/NodeDirectoryAdapter.js";

const formatter = new CliFormatter();
const session = new EditorSession(new SvgFileStore());
const plugins = new PluginHost({ editor: session, directory: new NodeDirectoryAdapter() });
const builtins = new BuiltinCommands(session);
plugins.activate(builtins.manifest, builtins);
const application = new CliApplication(
  new CommandDispatcher(session, plugins.commands),
  new CommandLineParser(),
  formatter,
);

void application.run().catch((error: unknown) => {
  stderr.write(`${formatter.formatError(error)}\n`);
  process.exitCode = 1;
}).finally(() => plugins.dispose());
