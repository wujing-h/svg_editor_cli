// 用途：提供画布尺寸的只读描述，避免向外暴露文档内部状态。
export interface CanvasSize {
  readonly width: number;
  readonly height: number;
}
