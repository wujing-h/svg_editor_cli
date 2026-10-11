// 用途：提供图形的只读属性描述，供后续 CLI 展示与 SVG 输出使用。
export interface ShapeDescription {
  readonly id: string;
  readonly kind: string;
  readonly attributes: Readonly<Record<string, string | number>>;
}
