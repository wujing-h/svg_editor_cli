// 用途：提供插件激活期间的受控注册入口，以及可释放资源和公开服务。
import type { AttributeHandler } from "./AttributeHandler.js";
import type { CommandDefinition } from "./CommandDefinition.js";
import type { EditorServices } from "./EditorServices.js";
import type { ShapeProvider } from "./ShapeProvider.js";
import type { TreeDecorator } from "./TreeDecorator.js";

export interface PluginDisposable {
  dispose(): void;
}

export interface PluginContext {
  readonly services: EditorServices;
  registerCommand(command: CommandDefinition): void;
  registerShape(provider: ShapeProvider): void;
  registerDecorator(decorator: TreeDecorator): void;
  registerAttributeHandler(handler: AttributeHandler): void;
  addDisposable(disposable: PluginDisposable): void;
  getCommandHelp(): readonly { readonly syntax: string; readonly description: string }[];
}
