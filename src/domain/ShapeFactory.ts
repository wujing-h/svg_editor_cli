// 用途：通过注入的提供者查询接口创建图形，不预置任何图形类型或参数分支。
import { Shape } from "./Shape.js";
import { ShapeTree } from "./ShapeTree.js";
import type { ShapeAttributes, ShapeProvider, ShapeProviderLookup } from "./ShapeProvider.js";

export class ShapeFactory {
  private readonly providers: ShapeProviderLookup;

  constructor(providers: ShapeProviderLookup) {
    this.providers = providers;
  }

  create(kind: string, id: string, attributes: ShapeAttributes = {}, text?: string): Shape {
    return this.validateResult(kind, id, this.findProvider(kind).create(id, attributes, text));
  }

  createFromParameters(kind: string, id: string, parameters: readonly string[]): Shape {
    return this.validateResult(kind, id, this.findProvider(kind).createFromParameters(id, parameters));
  }

  createFromSvg(kind: string, id: string, attributes: ShapeAttributes, text: string, children: readonly Shape[] = []): Shape {
    const dataKind = attributes["data-kind"];
    if (dataKind !== undefined && typeof dataKind !== "string") {
      throw new Error("invalid SVG data-kind");
    }
    // 标记对应的提供者未注册时，按原生标签读取；已注册但读取失败时不偷偷降级。
    const logicalProvider = dataKind === undefined ? undefined : this.providers.get(dataKind);
    const provider = logicalProvider ?? this.findProvider(kind);
    const shape = this.validateResult(provider.name, id, provider.createFromSvg({ id, tagName: kind, attributes, text, children }));
    const actualChildren = shape.children;
    if (actualChildren.length !== children.length || actualChildren.some((child, index) => child !== children[index])) {
      throw new Error(`invalid SVG subtree implementation: ${provider.name}`);
    }
    // 通过元数据重建语义时，必须保留原生标签，并确实返回标记声明的逻辑类型。
    if ((dataKind !== undefined && shape.kind !== kind) || (logicalProvider !== undefined && shape.type !== dataKind)) {
      throw new Error(`invalid SVG shape implementation: ${provider.name}`);
    }
    return shape;
  }

  private findProvider(kind: string): ShapeProvider {
    const provider = this.providers.get(kind);
    if (provider === undefined) {
      throw new Error(`unknown shape type: ${kind} (is the plugin loaded?)`);
    }
    return provider;
  }

  private validateResult(kind: string, id: string, shape: Shape): Shape {
    // 提供者必须返回当前请求的新根对象，不能冒用其他 id 或活动文档里的节点。
    if (!(shape instanceof Shape) || shape.id !== id || shape.parent !== undefined || shape.document !== undefined) {
      throw new Error(`invalid shape implementation: ${kind}`);
    }
    for (const node of ShapeTree.collect(shape)) {
      if (node.document !== undefined) {
        throw new Error(`invalid shape implementation: ${kind}`);
      }
    }
    return shape;
  }
}
