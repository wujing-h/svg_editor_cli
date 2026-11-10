// 用途：定义目录查询端口，命令无需直接依赖 Node.js 文件系统。
export interface DirectoryEntry {
  readonly name: string;
  readonly kind: "directory" | "file" | "link" | "other";
}

export interface DirectoryReader {
  getCurrentDirectory(): string;
  readDirectory(directory: string): Promise<readonly DirectoryEntry[]>;
}
