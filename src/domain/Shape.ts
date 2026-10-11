// 用途：定义图形的身份、统一几何操作与局部恢复契约。
import type { GeometrySnapshot } from "./GeometrySnapshot.js";
import type { ShapeDescription } from "./ShapeDescription.js";

export abstract class Shape {
  private readonly identifier: string;
  abstract readonly kind: string;

  protected constructor(id: string) {
    if (id.length === 0) {
      throw new Error("shape id must not be empty");
    }
    this.identifier = id;
  }

  get id(): string {
    return this.identifier;
  }

  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract describe(): ShapeDescription;
  abstract captureGeometry(): GeometrySnapshot;
  abstract restoreGeometry(snapshot: GeometrySnapshot): void;

  protected validateMove(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new Error("move offsets must be finite");
    }
  }

  protected validateScale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error("scale factor must be positive");
    }
  }
}
