// 用途：在装配侧解析插件模块及包清单，代码和配置装配共用宿主激活与错误隔离。
import { readFile } from "node:fs/promises";
import { createRequire, findPackageJSON } from "node:module";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginHost } from "../application/PluginHost.js";
import type { Plugin } from "../application/contracts/Plugin.js";
import type { PluginManifest } from "../application/contracts/PluginManifest.js";
import { PluginConfig } from "./PluginConfig.js";
import type { PluginConfigEntry } from "./PluginConfig.js";

export class PluginLoader {
  private readonly host: PluginHost;
  private readonly reportError: (error: unknown) => void;

  constructor(host: PluginHost, reportError: (error: unknown) => void) {
    this.host = host;
    this.reportError = reportError;
  }

  activate(manifest: PluginManifest, plugin: Plugin, options?: unknown): boolean {
    try {
      this.host.activate(manifest, plugin, options);
      return true;
    } catch (error: unknown) {
      this.report(error);
      return false;
    }
  }

  async loadConfig(filePath: string): Promise<void> {
    let config: PluginConfig;
    try {
      config = await PluginConfig.read(filePath);
    } catch {
      this.report(new Error("invalid plugin config"));
      return;
    }
    for (const entry of config.entries) {
      if (entry.enabled !== false) {
        await this.load(entry, config.directory);
      }
    }
  }

  private async load(entry: PluginConfigEntry, directory: string): Promise<void> {
    const base = pathToFileURL(join(directory, "plugins.config.cjs"));
    const requireFromConfig = createRequire(base);
    let resolved: string;
    try {
      // 先只解析入口，不求值；只有这里的缺失才属于“顶层插件找不到”。
      resolved = requireFromConfig.resolve(entry.module);
    } catch (error: unknown) {
      const code = error !== null && typeof error === "object" && "code" in error ? error.code : undefined;
      this.report(new Error(code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND"
        ? `plugin not found: ${entry.module}`
        : `plugin failed to activate: ${entry.module} (${this.reason(error)})`));
      return;
    }

    let name = entry.module;
    try {
      if (!isAbsolute(resolved)) {
        throw new Error("plugin entry must resolve to a file");
      }
      const manifestPath = findPackageJSON(pathToFileURL(resolved));
      if (manifestPath === undefined) {
        throw new Error("plugin package.json not found");
      }
      const manifest: unknown = JSON.parse((await readFile(manifestPath, "utf8")).replace(/^\uFEFF/, ""));
      if (manifest === null || typeof manifest !== "object" || !("name" in manifest) || typeof manifest.name !== "string") {
        throw new Error("invalid plugin manifest");
      }
      name = manifest.name;
      // 文件已解析成功；此后的依赖缺失、语法错误或顶层异常一律属于加载失败。
      const namespace: Record<string, unknown> = await import(pathToFileURL(resolved).href);
      let plugin = namespace.default;
      if (!Object.hasOwn(namespace, "default")) {
        this.report(new Error(`plugin has no default export: ${entry.module}`));
        return;
      }
      // TS 编译的 CommonJS 会把 default 再包一层；原生 CommonJS 的 module.exports 也可作为默认值。
      if (plugin !== null && typeof plugin === "object") {
        if (Object.hasOwn(plugin, "default") && !("activate" in plugin)) {
          plugin = (plugin as { default: unknown }).default;
        } else if ("__esModule" in plugin && plugin.__esModule === true && !Object.hasOwn(plugin, "default")) {
          this.report(new Error(`plugin has no default export: ${entry.module}`));
          return;
        }
      }
      if (plugin === null || (typeof plugin !== "object" && typeof plugin !== "function")) {
        throw new Error("invalid plugin default export");
      }
      this.activate(manifest as PluginManifest, plugin as Plugin, entry.options);
    } catch (error: unknown) {
      this.report(new Error(`plugin failed to activate: ${name} (${this.reason(error)})`));
    }
  }

  private reason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private report(error: unknown): void {
    try {
      this.reportError(error);
    } catch {
      // 报告通道异常不能阻止后续插件及默认 CLI 启动。
    }
  }
}
