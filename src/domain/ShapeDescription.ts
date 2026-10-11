// 用途：提供图形的只读属性描述，供后续 CLI 展示与 SVG 输出使用。
export interface ShapeDescription {
  readonly id: string;
  readonly kind: string;
  readonly attributes: Readonly<Record<string, string | number>>;
  // 叶子的参考位置供移动摘要使用；容器没有独立几何坐标。
  readonly position?: { readonly x: number; readonly y: number };
  readonly children?: readonly ShapeDescription[];
  readonly text?: string;
}
