// 用途：封装 SVG 文档的画布尺寸，并在修改前验证尺寸合法性。
import type { CanvasSize } from "./CanvasSize.js";

export class SvgDocument {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    SvgDocument.validateSize(width, height);
    this.width = width;
    this.height = height;
  }

  getCanvasSize(): CanvasSize {
    // 返回独立描述，调用方无法通过返回对象修改文档。
    return { width: this.width, height: this.height };
  }

  resizeCanvas(width: number, height: number): void {
    // 两个尺寸均通过校验后才写入，避免宽度更新而高度报错。
    SvgDocument.validateSize(width, height);
    this.width = width;
    this.height = height;
  }

  private static validateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error("canvas dimensions must be finite and positive");
    }
  }
}
