// 用途：通过目录接口列出当前目录直接子项，稳定排序且不访问或修改 SVG 文档。
import type { Command, CommandResult, CommandToken, DirectoryEntry, DirectoryReader } from "pj/plugin-api";

export class DirCommand implements Command {
  private readonly directory: DirectoryReader;
  private readonly tokens: readonly CommandToken[];

  constructor(directory: DirectoryReader, tokens: readonly CommandToken[]) {
    this.directory = directory;
    this.tokens = [...tokens];
  }

  async execute(): Promise<CommandResult> {
    if (this.tokens.length !== 0) {
      throw new Error("usage: dir");
    }
    const target = this.directory.getCurrentDirectory();
    let entries: readonly DirectoryEntry[];
    try {
      entries = await this.directory.readDirectory(target);
    } catch {
      // 适配器或替身可以抛自己的异常，命令统一对外报告目标路径。
      throw new Error(`cannot read directory: ${target}`);
    }
    const kinds: Record<DirectoryEntry["kind"], { readonly order: number; readonly label: string }> = {
      directory: { order: 0, label: "[DIR]" },
      file: { order: 1, label: "[FILE]" },
      link: { order: 2, label: "[LINK]" },
      other: { order: 3, label: "[OTHER]" },
    };
    // 不改写适配器返回的集合；每组使用明确字符串顺序，不依赖 locale。
    const sorted = entries.filter((entry) => entry.name !== "." && entry.name !== "..").sort((left, right) =>
      kinds[left.kind].order - kinds[right.kind].order || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    return { lines: sorted.length === 0 ? ["(empty directory)"] : sorted.map((entry) =>
      `${kinds[entry.kind].label}  ${this.displayName(entry.name)}`) };
  }

  private displayName(name: string): string {
    // 保持一个目录项一行；正常名称原样显示，控制字符使用可见的转义表示。
    return /[\u0000-\u001F\u007F\u0085\u2028\u2029]/u.test(name)
      ? JSON.stringify(name).replace(/[\u007F\u0085\u2028\u2029]/gu, (value) => `\\u${value.charCodeAt(0).toString(16).padStart(4, "0")}`)
      : name;
  }
}
