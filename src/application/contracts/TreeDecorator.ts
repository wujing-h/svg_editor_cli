// 用途：定义树行后缀扩展；标签只读取描述，不修改图形或基础渲染结果。
import type { CanvasSize } from "../../domain/CanvasSize.js";
import type { ShapeDescription } from "../../domain/ShapeDescription.js";

export interface TreeLineContext {
  readonly shape: ShapeDescription | undefined;
  readonly canvas: CanvasSize | undefined;
}

export interface TreeDecorator {
  readonly name: string;
  readonly order: number;
  getSuffix(context: TreeLineContext): string | undefined;
}
