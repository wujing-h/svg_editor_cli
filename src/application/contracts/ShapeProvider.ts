// 用途：定义图形插件的创建和完整子树读回入口，类型识别由提供者负责。
import type { Shape } from "../../domain/Shape.js";

export interface SvgShapeInput {
  readonly id: string;
  readonly tagName: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text: string;
  readonly children: readonly Shape[];
}

export interface ShapeProvider {
  readonly name: string;
  createFromParameters(id: string, parameters: readonly string[]): Shape;
  createFromSvg(input: SvgShapeInput): Shape;
}
