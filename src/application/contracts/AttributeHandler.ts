// 用途：定义属性处理策略及受控写入接口，为后续多属性事务提供契约。
import type { ShapeDescription } from "../../domain/ShapeDescription.js";

export interface AttributeContext {
  getShape(id: string): ShapeDescription;
  setAttribute(id: string, attribute: string, value: string | number): void;
}

export interface AttributeHandler {
  readonly name: string;
  handles(shape: ShapeDescription, attribute: string): boolean;
  apply(context: AttributeContext, shape: ShapeDescription, attribute: string, value: string): void;
}
