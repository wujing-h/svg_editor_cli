// 用途：从注入的注册表取得命令对象，交给会话统一执行及管理历史。
import type { CommandRegistry } from "./CommandRegistry.js";
import type { EditorSession } from "./EditorSession.js";
import type { CommandInput } from "./contracts/CommandInput.js";
import type { CommandResult } from "./contracts/CommandResult.js";

export class CommandDispatcher {
  private readonly session: EditorSession;
  private readonly registry: CommandRegistry;

  constructor(session: EditorSession, registry: CommandRegistry) {
    this.session = session;
    this.registry = registry;
  }

  async dispatch(input: CommandInput): Promise<CommandResult> {
    const command = this.registry.create(input);
    return await this.session.execute(command);
  }
}
