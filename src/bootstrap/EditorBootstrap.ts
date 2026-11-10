// 用途：集中装配默认编辑器，并在启动 REPL 前选择代码或配置方式激活可选插件。
import { CommandDispatcher } from "../application/CommandDispatcher.js";
import { EditorSession } from "../application/EditorSession.js";
import { PluginHost } from "../application/PluginHost.js";
import { ShapeRegistry } from "../application/ShapeRegistry.js";
import { AttributeService } from "../application/AttributeService.js";
import { BuiltinCommands } from "../builtins/BuiltinCommands.js";
import { BuiltinShapes } from "../builtins/BuiltinShapes.js";
import { ShapeFactory } from "../domain/ShapeFactory.js";
import { CliApplication } from "../cli/CliApplication.js";
import { CliFormatter } from "../cli/CliFormatter.js";
import { CommandLineParser } from "../cli/CommandLineParser.js";
import { SvgFileStore } from "../infrastructure/SvgFileStore.js";
import { SvgReader } from "../infrastructure/SvgReader.js";
import { SvgWriter } from "../infrastructure/SvgWriter.js";
import { NodeDirectoryAdapter } from "../infrastructure/NodeDirectoryAdapter.js";
import { PluginLoader } from "./PluginLoader.js";

export class EditorBootstrap {
  readonly session: EditorSession;
  readonly plugins: PluginHost;
  readonly factory: ShapeFactory;
  readonly formatter: CliFormatter;
  readonly loader: PluginLoader;
  private readonly application: CliApplication;
  private readonly reportError: (error: unknown) => void;

  constructor(reportError: (error: unknown) => void) {
    this.reportError = reportError;
    const shapes = new ShapeRegistry();
    this.factory = new ShapeFactory(shapes);
    this.session = new EditorSession(new SvgFileStore(new SvgWriter(), new SvgReader(this.factory)), reportError);
    this.plugins = new PluginHost({ editor: this.session, directory: new NodeDirectoryAdapter() }, shapes);
    this.formatter = new CliFormatter(() => this.plugins.decorators.getAll(), reportError);
    this.loader = new PluginLoader(this.plugins, reportError);
    const builtinShapes = new BuiltinShapes();
    this.plugins.activate(builtinShapes.manifest, builtinShapes);
    const commands = new BuiltinCommands(this.session, this.factory, new AttributeService(() => this.plugins.attributes.getAll()));
    this.plugins.activate(commands.manifest, commands);
    this.application = new CliApplication(new CommandDispatcher(this.session, this.plugins.commands), new CommandLineParser(), this.formatter);
  }

  async run(args: readonly string[]): Promise<void> {
    if (args.length === 0) {
      this.activateCodePlugins();
    } else if (args.length === 2 && args[0] === "--config" && args[1] !== undefined && args[1] !== "") {
      await this.loader.loadConfig(args[1]);
    } else {
      this.reportError(new Error("usage: svg-editor [--config <file>]"));
    }
    await this.application.run();
  }

  dispose(): void {
    this.plugins.dispose();
  }

  private activateCodePlugins(): void {
    // 可选插件的代码装配固定在此处：导入实例与包清单，再调用 this.loader.activate。
    // 当前尚未接入可选插件；显式 --config 时仅采用配置，不叠加代码装配。
  }
}
