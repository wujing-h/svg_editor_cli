// 用途：定义树行后缀扩展；标签只读取描述，不修改图形或基础渲染结果。
import type { CanvasSize } from "../../domain/CanvasSize.js";
import type { ShapeDescription } from "../../domain/ShapeDescription.js";

export interface TreeLineContext {
  // 两者仅有一个存在；SVG 根行提供 canvas，图形行提供 shape，数据均冻结。
  readonly shape: ShapeDescription | undefined;
  readonly canvas: CanvasSize | undefined;
}

export interface TreeDecorator {
  readonly name: string;
  readonly order: number;
  // 同步返回单行后缀；undefined / 空白串表示不追加标签。
  getSuffix(context: TreeLineContext): string | undefined;
}
