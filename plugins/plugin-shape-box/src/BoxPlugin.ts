// 用途：同包注册 box 提供者、属性策略和类型标签，通过宿主原子激活。
import type { Plugin, PluginContext } from "pj/plugin-api";
import { BoxProvider } from "./BoxProvider.js";
import { BoxAttributes } from "./BoxAttributes.js";
import { BoxTypeLabel } from "./BoxTypeLabel.js";

export class BoxPlugin implements Plugin {
  activate(context: PluginContext, options?: unknown): void {
    if (options !== undefined) throw new Error("box plugin does not accept options");
    context.registerShape(new BoxProvider());
    context.registerAttributeHandler(new BoxAttributes());
    context.registerDecorator(new BoxTypeLabel());
  }
}
