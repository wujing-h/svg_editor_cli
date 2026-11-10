// 用途：定义领域侧图形构造协议，工厂只依赖协议，不依赖应用层或内置类型。
import type { Shape } from "./Shape.js";

export type ShapeAttributes = Readonly<Record<string, string | number>>;

export interface SvgShapeInput {
  readonly id: string;
  readonly tagName: string;
  readonly attributes: ShapeAttributes;
  readonly text: string;
  readonly children: readonly Shape[];
}

export interface ShapeProvider {
  readonly name: string;
  create(id: string, attributes?: ShapeAttributes, text?: string): Shape;
  createFromParameters(id: string, parameters: readonly string[]): Shape;
  createFromSvg(input: SvgShapeInput): Shape;
}

export interface ShapeProviderLookup {
  get(name: string): ShapeProvider | undefined;
}
