// 用途：校验并注册图形提供者，为领域工厂提供按名称查询的入口。
import type { ShapeProvider } from "../domain/ShapeProvider.js";
import { ExtensionRegistry } from "./ExtensionRegistry.js";

export class ShapeRegistry extends ExtensionRegistry<ShapeProvider> {
  constructor() {
    super("shapes", (entry) => typeof entry.create === "function" &&
      typeof entry.createFromParameters === "function" && typeof entry.createFromSvg === "function");
  }
}
