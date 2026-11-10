// 用途：整体读取并校验插件配置，确保坏配置不会先激活前半段插件。
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface PluginConfigEntry {
  readonly module: string;
  readonly enabled?: boolean;
  readonly options?: unknown;
}

export class PluginConfig {
  readonly directory: string;
  readonly entries: readonly PluginConfigEntry[];

  private constructor(directory: string, entries: readonly PluginConfigEntry[]) {
    this.directory = directory;
    this.entries = entries;
  }

  static async read(filePath: string): Promise<PluginConfig> {
    const absolutePath = resolve(filePath);
    const source = await readFile(absolutePath, "utf8");
    const data: unknown = JSON.parse(source.replace(/^\uFEFF/, ""));
    if (!PluginConfig.isObject(data) || Object.keys(data).some((key) => key !== "plugins") || !Array.isArray(data.plugins)) {
      throw new Error("invalid plugin config");
    }
    const entries: PluginConfigEntry[] = [];
    for (const entry of data.plugins) {
      if (!PluginConfig.isObject(entry) || typeof entry.module !== "string" || entry.module.trim() === "" ||
        (entry.enabled !== undefined && typeof entry.enabled !== "boolean") ||
        Object.keys(entry).some((key) => !["module", "enabled", "options"].includes(key))) {
        throw new Error("invalid plugin config");
      }
      entries.push(entry as unknown as PluginConfigEntry);
    }
    return new PluginConfig(dirname(absolutePath), entries);
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
