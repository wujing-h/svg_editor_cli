// 用途：描述图形的可选初始样式，区分属性缺失与显式设置。
export interface ShapeStyles {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}
