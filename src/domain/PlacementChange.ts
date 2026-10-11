// 用途：保存一次换父或同级换位的前后位置，不复制整份文档。
import type { SubtreeLocation } from "./SubtreeLocation.js";

export interface PlacementChange {
  readonly before: SubtreeLocation;
  readonly after: SubtreeLocation;
}
