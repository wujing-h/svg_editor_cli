// 用途：按名称管理命令构造入口和帮助信息，不依赖具体命令实现。
import type { Command } from "./contracts/Command.js";
import type { CommandDefinition } from "./contracts/CommandDefinition.js";
import type { CommandInput } from "./contracts/CommandInput.js";
import { ExtensionRegistry } from "./ExtensionRegistry.js";

export class CommandRegistry extends ExtensionRegistry<CommandDefinition> {
  constructor() {
    super("commands");
  }

  override register(definition: CommandDefinition): void {
    const { name, syntax, description } = definition;
    if (typeof name !== "string" || typeof syntax !== "string" || typeof description !== "string" ||
        typeof definition.create !== "function" || syntax.trim() === "" || /[\r\n]/.test(syntax + description)) {
      throw new Error(`invalid command registration: ${name}`);
    }
    // 固定元数据并保留类方法的 this；注册后外部修改不会偷偷改写帮助。
    super.register({ name, syntax, description, create: definition.create.bind(definition) });
  }

  create(input: CommandInput): Command {
    const definition = this.get(input.name);
    if (definition === undefined) {
      throw new Error(`unknown command: ${input.name}`);
    }
    // 每次构造独立对象，避免两条编辑共用同一份撤销状态。
    const command = definition.create(input.arguments);
    if (command === null || command === undefined || typeof command.execute !== "function") {
      throw new Error(`invalid command implementation: ${input.name}`);
    }
    return command;
  }

  getHelp(): readonly { readonly syntax: string; readonly description: string }[] {
    // Map 保留注册顺序，返回独立描述供 CLI 排版。
    return this.getAll().map(({ syntax, description }) => ({ syntax, description }));
  }
}
