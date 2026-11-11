// 用途：每次激活创建独立标签实例，并把只读会话订阅交给宿主释放。
import type { EditorServices, Plugin, PluginContext } from "pj/plugin-api";
import { ModifiedStar } from "./ModifiedStar.js";

type StarContext = Pick<PluginContext, "registerDecorator" | "addDisposable"> & {
  readonly services: { readonly editor: Pick<EditorServices["editor"], "getSnapshot" | "onDidChange"> };
};

export class ModifiedStarPlugin implements Plugin {
  activate(context: StarContext, options?: unknown): void {
    if (options !== undefined) throw new Error("modified-star plugin does not accept options");
    const editor = context.services.editor;
    const label = new ModifiedStar(editor.getSnapshot());
    context.registerDecorator(label);
    context.addDisposable(editor.onDidChange((event) => label.observe(event, editor.getSnapshot() ?? event.snapshot)));
  }
}
