// 用途：组装 CLI 的解析、分发与展示对象，并启动程序。
import { stderr } from "node:process";
import { CommandDispatcher } from "./application/CommandDispatcher.js";
import { EditorSession } from "./application/EditorSession.js";
import { PluginHost } from "./application/PluginHost.js";
import { ShapeRegistry } from "./application/ShapeRegistry.js";
import { BuiltinCommands } from "./builtins/BuiltinCommands.js";
import { BuiltinShapes } from "./builtins/BuiltinShapes.js";
import { ShapeFactory } from "./domain/ShapeFactory.js";
import { CliApplication } from "./cli/CliApplication.js";
import { CliFormatter } from "./cli/CliFormatter.js";
import { CommandLineParser } from "./cli/CommandLineParser.js";
import { SvgFileStore } from "./infrastructure/SvgFileStore.js";
import { SvgReader } from "./infrastructure/SvgReader.js";
import { SvgWriter } from "./infrastructure/SvgWriter.js";
import { NodeDirectoryAdapter } from "./infrastructure/NodeDirectoryAdapter.js";

const formatter = new CliFormatter();
const shapes = new ShapeRegistry();
const factory = new ShapeFactory(shapes);
// 创建命令和 SVG 读取共享同一注册表，后续激活的图形插件对两个入口同时生效。
const session = new EditorSession(new SvgFileStore(new SvgWriter(), new SvgReader(factory)));
const plugins = new PluginHost({ editor: session, directory: new NodeDirectoryAdapter() }, shapes);
const builtinShapes = new BuiltinShapes();
plugins.activate(builtinShapes.manifest, builtinShapes);
const builtins = new BuiltinCommands(session, factory);
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
