// 用途：定义插件同步注册生命周期；实际命令仍可异步执行文件操作。
import type { PluginContext } from "./PluginContext.js";

export interface Plugin {
  activate(context: PluginContext, options?: unknown): void;
}
