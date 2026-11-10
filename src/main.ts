// 用途：把启动参数交给组合根，运行 CLI 并在退出时释放插件资源。
import { stderr } from "node:process";
import { CliFormatter } from "./cli/CliFormatter.js";
import { EditorBootstrap } from "./bootstrap/EditorBootstrap.js";

const formatter = new CliFormatter();
const editor = new EditorBootstrap(reportError);

void editor.run(process.argv.slice(2)).catch((error: unknown) => {
  reportError(error);
  process.exitCode = 1;
}).finally(() => editor.dispose());

function reportError(error: unknown): void {
  stderr.write(`${formatter.formatError(error)}\n`);
}
