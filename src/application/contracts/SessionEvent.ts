// 用途：公开独立只读内容快照和成功操作事件，供插件维护自己的内容基线。
import type { CanvasSize } from "../../domain/CanvasSize.js";
import type { ShapeDescription } from "../../domain/ShapeDescription.js";

export interface DocumentSnapshot {
  readonly canvas: CanvasSize;
  readonly roots: readonly ShapeDescription[];
}

export type SessionEventKind = "initialize" | "read" | "save" | "canvas" | "edit" | "undo" | "redo";

export interface SessionEvent {
  readonly kind: SessionEventKind;
  // save 携带提交给存储层时的内容，其余事件携带操作成功后的内容。
  readonly snapshot: DocumentSnapshot;
}

export type SessionListener = (event: SessionEvent) => void;
