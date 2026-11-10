// 用途：定义同步属性策略和仅在本次编辑内有效的只读查询、受控写入接口。
import type { ShapeDescription } from "../../domain/ShapeDescription.js";

export interface AttributeContext {
  // 返回冻结的独立描述，不提供可变图形或结构写入口。
  getShape(id: string): ShapeDescription;
  setAttribute(id: string, attribute: string, value: string | number): void;
}

export interface AttributeHandler {
  readonly name: string;
  handles(shape: ShapeDescription, attribute: string): boolean;
  // 同步执行；所有写入须经 context，异常回滚，不回退默认处理。
  apply(context: AttributeContext, shape: ShapeDescription, attribute: string, value: string): void;
}
