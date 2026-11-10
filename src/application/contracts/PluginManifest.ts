// 用途：定义插件清单中的四类贡献名称，与实际暂存注册逐项比较。
export interface PluginManifest {
  readonly name: string;
  readonly contributes?: {
    readonly commands?: readonly string[];
    readonly shapes?: readonly string[];
    readonly decorators?: readonly string[];
    readonly attributes?: readonly string[];
  };
}
