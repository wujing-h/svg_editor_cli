// 用途：保存单个图形的独立几何值，并防止将恢复记录用于其他对象。
import type { Shape } from "./Shape.js";

export class GeometrySnapshot {
  private readonly shape: Shape;
  private readonly values: Readonly<Record<string, number>>;

  constructor(shape: Shape, values: Readonly<Record<string, number>>) {
    this.shape = shape;
    // 复制数值，不与调用方共享可变属性对象；只记录局部几何状态。
    this.values = { ...values };
  }

  getValue(shape: Shape, attribute: string): number {
    // 对象身份比 id 更严格：同名新对象也不能使用旧对象的恢复记录。
    if (shape !== this.shape) {
      throw new Error("geometry snapshot belongs to another shape");
    }
    const value = this.values[attribute];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`invalid geometry snapshot value: ${attribute}`);
    }
    return value;
  }
}
