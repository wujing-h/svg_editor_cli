// 用途：通过应用层契约传递独立只读图形描述，CLI 不接触可变领域对象。
import type { ShapeDescription } from "../../domain/ShapeDescription.js";

export type ShapeView = ShapeDescription;
