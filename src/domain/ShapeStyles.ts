// 用途：描述图形的可选初始样式，区分属性缺失与显式设置。
export interface ShapeStyles {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  // 外部 SVG 的展示属性只读保留，不能通过 set 扩大课程规定的白名单。
  readonly fontSize?: string;
  readonly textAnchor?: string;
}
