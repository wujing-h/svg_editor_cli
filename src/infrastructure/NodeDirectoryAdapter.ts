// 用途：将 Node.js 当前目录和目录项查询适配为应用层目录访问接口。
import { readdir } from "node:fs/promises";
import { cwd } from "node:process";
import type { DirectoryEntry, DirectoryReader } from "../application/contracts/DirectoryReader.js";

export class NodeDirectoryAdapter implements DirectoryReader {
  private readonly currentDirectory: () => string;

  constructor(currentDirectory: () => string = cwd) {
    this.currentDirectory = currentDirectory;
  }

  getCurrentDirectory(): string {
    return this.currentDirectory();
  }

  async readDirectory(directory: string): Promise<readonly DirectoryEntry[]> {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        // 不跟随链接；排序和显示格式留给 dir 命令策略。
        kind: entry.isSymbolicLink() ? "link" : entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
      }));
    } catch {
      throw new Error(`cannot read directory: ${directory}`);
    }
  }
}
