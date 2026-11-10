// 用途：组装 VSCode 扩展功能，将提供者注册给宿主并管理资源释放。
import { FileType, window, workspace } from "vscode";
import type { ExtensionContext } from "vscode";
import { SvgFileDecorationProvider } from "./SvgFileDecorationProvider.js";

export function activate(context: ExtensionContext): void {
  const output = window.createOutputChannel("SVG Course Tools");
  // VSCode 停用扩展时统一释放资源；不弹窗，也不修改用户打开的文件。
  context.subscriptions.push(output);
  const decorations = new SvgFileDecorationProvider(async (uri) => {
    const stat = await workspace.fs.stat(uri);
    // 使用宿主文件系统，保留远程工作区等 URI 的支持；FileType 是位标志。
    return (stat.type & FileType.File) !== 0;
  });
  context.subscriptions.push(window.registerFileDecorationProvider(decorations));
  output.appendLine("SVG Course Tools activated.");
}
