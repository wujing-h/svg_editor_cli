// 用途：统一管理具名扩展，拒绝重复注册，为插件回滚提供精确撤销入口。
export class ExtensionRegistry<T extends { readonly name: string }> {
  private readonly entries = new Map<string, T>();
  private readonly category: string;
  private readonly validate: (entry: T) => boolean;

  constructor(category: string, validate: (entry: T) => boolean = () => true) {
    this.category = category;
    this.validate = validate;
  }

  register(entry: T): void {
    const name = entry.name;
    if (typeof name !== "string" || name.length === 0 || /\s/.test(name) || !this.validate(entry)) {
      throw new Error(`invalid registration: ${this.category}/${String(name)}`);
    }
    if (this.entries.has(name)) {
      throw new Error(`duplicate registration: ${this.category}/${name}`);
    }
    this.entries.set(name, entry);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  get(name: string): T | undefined {
    return this.entries.get(name);
  }

  getAll(): readonly T[] {
    return [...this.entries.values()];
  }

  // 只供宿主回滚本次提交，不放入插件公开上下文。
  unregister(name: string): void {
    this.entries.delete(name);
  }
}
