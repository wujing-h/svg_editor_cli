// 用途：通过注入的提供者查询接口创建图形，不预置任何图形类型或参数分支。
import { Shape } from "./Shape.js";
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
    return this.validateResult(kind, id, this.findProvider(kind).createFromSvg({ id, tagName: kind, attributes, text, children }));
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
    return shape;
  }
}
