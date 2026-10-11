// 用途：定义命令返回的展示数据，让终端排版与应用逻辑分开。
import type { ShapeView } from "./ShapeView.js";

export interface CommandResult {
  readonly tree?: {
    readonly canvas?: { readonly width: number; readonly height: number };
    readonly roots: readonly ShapeView[];
  };
  readonly shapeDetails?: {
    readonly shape: ShapeView;
    readonly parent: { readonly id: string; readonly kind: string } | undefined;
  };
  readonly attributeChange?: {
    readonly kind: string;
    readonly id: string;
    readonly attribute: string;
    readonly value: string | number | undefined;
  };
  readonly summary?: {
    readonly template: string;
    readonly values: Readonly<Record<string, string | number>>;
  };
  readonly help?: readonly {
    readonly syntax: string;
    readonly description: string;
  }[];
}
