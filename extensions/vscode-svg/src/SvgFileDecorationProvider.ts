// 用途：为真实 SVG 文件提供 Explorer 行尾标记，跳过目录、读取失败和已取消的请求。
import type { CancellationToken, FileDecoration, FileDecorationProvider, Uri } from "vscode";

export class SvgFileDecorationProvider implements FileDecorationProvider {
  private readonly isFile: (uri: Uri) => Promise<boolean>;

  constructor(isFile: (uri: Uri) => Promise<boolean>) {
    // 由激活入口注入文件查询，规则测试不必启动 VSCode 或访问真实文件系统。
    this.isFile = isFile;
  }

  async provideFileDecoration(uri: Uri, token: CancellationToken): Promise<FileDecoration | undefined> {
    if (token.isCancellationRequested || !uri.path.toLowerCase().endsWith(".svg")) {
      return undefined;
    }

    try {
      // 后缀不足以判断文件类型：folder.svg 可能是目录，查询期间文件也可能已被删除。
      if (!await this.isFile(uri) || token.isCancellationRequested) {
        return undefined;
      }
    } catch {
      return undefined;
    }

    // 返回展示元数据，不改文件名或内容，也不向父目录传播标记。
    return { badge: "[]", tooltip: "SVG file", propagate: false };
  }
}
