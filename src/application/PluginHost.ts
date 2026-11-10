// 用途：暂存并校验插件注册，成功后统一接入，失败时回滚本次扩展和资源。
import { CommandRegistry } from "./CommandRegistry.js";
import { ExtensionRegistry } from "./ExtensionRegistry.js";
import { ShapeRegistry } from "./ShapeRegistry.js";
import type { AttributeHandler } from "./contracts/AttributeHandler.js";
import type { EditorServices } from "./contracts/EditorServices.js";
import type { Plugin } from "./contracts/Plugin.js";
import type { PluginContext, PluginDisposable } from "./contracts/PluginContext.js";
import type { PluginManifest } from "./contracts/PluginManifest.js";
import type { TreeDecorator } from "./contracts/TreeDecorator.js";

interface Registration {
  readonly category: string;
  readonly name: string;
  readonly exists: () => boolean;
  readonly commit: () => void;
  readonly rollback: () => void;
}

export class PluginHost implements PluginDisposable {
  readonly commands = new CommandRegistry();
  readonly shapes: ShapeRegistry;
  readonly decorators = new ExtensionRegistry<TreeDecorator>("decorators", (entry) =>
    Number.isFinite(entry.order) && typeof entry.getSuffix === "function");
  readonly attributes = new ExtensionRegistry<AttributeHandler>("attributes", (entry) =>
    typeof entry.handles === "function" && typeof entry.apply === "function");
  private readonly services: EditorServices;
  private readonly resources: PluginDisposable[] = [];
  private disposed = false;

  constructor(services: EditorServices, shapes: ShapeRegistry = new ShapeRegistry()) {
    this.services = Object.freeze({ editor: services.editor, directory: services.directory });
    this.shapes = shapes;
  }

  activate(manifest: PluginManifest, plugin: Plugin, options?: unknown): void {
    if (this.disposed) {
      throw new Error("plugin host is disposed");
    }
    const pendingCommands = new CommandRegistry();
    const pendingShapes = new ShapeRegistry();
    const pendingDecorators = new ExtensionRegistry<TreeDecorator>("decorators", (entry) =>
      Number.isFinite(entry.order) && typeof entry.getSuffix === "function");
    const pendingAttributes = new ExtensionRegistry<AttributeHandler>("attributes", (entry) =>
      typeof entry.handles === "function" && typeof entry.apply === "function");
    const registrations: Registration[] = [];
    const committed: Registration[] = [];
    const disposables: PluginDisposable[] = [];
    let accepting = true;
    let registrationFailure: unknown;

    const ensureOpen = (): void => {
      if (!accepting) {
        throw new Error("plugin activation context is closed");
      }
    };
    const stage = <T extends { readonly name: string }>(
      category: string, target: ExtensionRegistry<T>, pending: ExtensionRegistry<T>, entry: T,
    ): void => {
      try {
        ensureOpen();
        const name = entry.name;
        if (target.has(name)) {
          throw new Error(`duplicate registration: ${category}/${name}`);
        }
        pending.register(entry);
        const registered = pending.get(name);
        if (registered === undefined) {
          throw new Error("missing staged registration");
        }
        registrations.push({ category, name, exists: () => target.has(name),
          commit: () => {
            if (registered.name !== name) {
              throw new Error(`registration name changed: ${category}/${name}`);
            }
            target.register(registered);
          }, rollback: () => target.unregister(name) });
      } catch (error: unknown) {
        // 插件自行捕获错误，也不能把一次重复注册偷偷变成激活成功。
        registrationFailure ??= error;
        throw error;
      }
    };
    const context = Object.freeze<PluginContext>({
      services: this.services,
      registerCommand: (entry) => stage("commands", this.commands, pendingCommands, entry),
      registerShape: (entry) => stage("shapes", this.shapes, pendingShapes, entry),
      registerDecorator: (entry) => stage("decorators", this.decorators, pendingDecorators, entry),
      registerAttributeHandler: (entry) => stage("attributes", this.attributes, pendingAttributes, entry),
      addDisposable: (resource) => {
        ensureOpen();
        if (typeof resource?.dispose !== "function") {
          throw new Error("invalid plugin resource");
        }
        disposables.push(resource);
      },
      getCommandHelp: () => accepting
        ? [...this.commands.getHelp(), ...pendingCommands.getHelp()] : this.commands.getHelp(),
    });

    try {
      if (typeof manifest.name !== "string" || manifest.name.trim() === "" || typeof plugin.activate !== "function") {
        throw new Error("invalid plugin or manifest");
      }
      // 激活只负责同步注册。命令执行可异步，避免激活结束后还有晚到的注册写入。
      const result: unknown = plugin.activate(context, options);
      if (registrationFailure !== undefined) {
        throw registrationFailure;
      }
      if (result !== null && typeof result === "object" && "then" in result) {
        void Promise.resolve(result).catch(() => undefined);
        throw new Error("activate must register synchronously");
      }
      this.validateManifest(manifest, registrations);
      for (const registration of registrations) {
        if (registration.exists()) {
          throw new Error(`duplicate registration: ${registration.category}/${registration.name}`);
        }
      }
      for (const registration of registrations) {
        registration.commit();
        committed.push(registration);
      }
      this.resources.push(...disposables);
    } catch (error: unknown) {
      // 已成功插件不在本批日志里；当前插件即使贡献多类扩展，也只能整体成功或失败。
      for (const registration of committed.reverse()) {
        registration.rollback();
      }
      accepting = false;
      this.release(disposables);
      const reason = error instanceof Error ? error.message : String(error);
      if (reason.startsWith("duplicate registration:") || reason.startsWith("plugin manifest mismatch:")) {
        throw error;
      }
      throw new Error(`plugin failed to activate: ${manifest.name} (${reason})`);
    } finally {
      accepting = false;
    }
  }

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.release(this.resources);
    }
  }

  private validateManifest(manifest: PluginManifest, registrations: readonly Registration[]): void {
    // 配置加载会带来未经过 TS 检查的 JSON；null / 数组不能冒充缺省声明。
    if (manifest.contributes !== undefined && (manifest.contributes === null ||
      typeof manifest.contributes !== "object" || Array.isArray(manifest.contributes))) {
      throw new Error("invalid contributes declaration");
    }
    const categories = ["shapes", "commands", "decorators", "attributes"] as const;
    const declared: string[] = [];
    const registered: string[] = [];
    let matches = Object.keys(manifest.contributes ?? {}).every((key) => categories.some((category) => category === key));
    for (const category of categories) {
      const declaredNames = manifest.contributes?.[category];
      const names = declaredNames === undefined ? [] : declaredNames;
      const actual = registrations.filter((entry) => entry.category === category).map((entry) => entry.name).sort();
      if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) {
        throw new Error("invalid contributes declaration");
      }
      const expected = [...names].sort();
      matches = matches && new Set(expected).size === expected.length &&
        expected.length === actual.length && expected.every((name, index) => name === actual[index]);
      declared.push(`${category}=[${expected.join(",")}]`);
      registered.push(`${category}=[${actual.join(",")}]`);
    }
    if (!matches) {
      throw new Error(`plugin manifest mismatch: ${manifest.name} (declared: ${declared.join("; ")}, registered: ${registered.join("; ")})`);
    }
  }

  private release(resources: PluginDisposable[]): void {
    for (const resource of resources.reverse()) {
      try {
        resource.dispose();
      } catch {
        // 一项清理失败不能阻止其他资源释放，也不能掩盖原始激活错误。
      }
    }
    resources.length = 0;
  }
}
