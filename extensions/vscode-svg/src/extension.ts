// 用途：提供 VSCode 扩展的激活入口，后续在这里组装文件标记与大纲功能。
import { window } from "vscode";
import type { ExtensionContext } from "vscode";

export function activate(context: ExtensionContext): void {
  const output = window.createOutputChannel("SVG Course Tools");
  // VSCode 停用扩展时统一释放资源；不弹窗，也不修改用户打开的文件。
  context.subscriptions.push(output);
  output.appendLine("SVG Course Tools activated.");
}
