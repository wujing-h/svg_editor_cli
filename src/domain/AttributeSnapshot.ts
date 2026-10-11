// 用途：保存一个属性的局部值及缺失状态，绑定原图形以支持准确恢复。
import type { Shape } from "./Shape.js";

export class AttributeSnapshot {
  readonly attribute: string;
  private readonly shape: Shape;
  private readonly value: string | number | undefined;

  constructor(shape: Shape, attribute: string, value: string | number | undefined) {
    this.shape = shape;
    this.attribute = attribute;
    // 值为不可变的标量；undefined 表示未设置，不替换成 SVG 默认值。
    this.value = value;
  }

  getValue(shape: Shape): string | number | undefined {
    if (shape !== this.shape) {
      throw new Error("attribute snapshot belongs to another shape");
    }
    return this.value;
  }
}
