// 用途：保存一批属性的局部前后值，原子恢复并在中途失败时补偿已尝试的写入。
import type { AttributeSnapshot } from "../domain/AttributeSnapshot.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export interface AttributeState {
  readonly shape: Shape;
  readonly snapshot: AttributeSnapshot;
}

export interface AttributeEntry {
  readonly shape: Shape;
  readonly before: AttributeSnapshot;
  readonly after: AttributeSnapshot;
}

export class AttributeChange {
  private readonly document: SvgDocument;
  private readonly entries: readonly AttributeEntry[];

  constructor(document: SvgDocument, entries: readonly AttributeEntry[]) {
    this.document = document;
    this.entries = entries.map((entry) => ({ ...entry }));
  }

  restore(after: boolean): void {
    const entries = after ? this.entries : [...this.entries].reverse();
    AttributeChange.restoreStates(this.document, entries.map((entry) => ({
      shape: entry.shape, snapshot: after ? entry.after : entry.before,
    })));
  }

  static restoreStates(document: SvgDocument, states: readonly AttributeState[]): void {
    // 所有目标必须仍是原对象；同名替代对象不能接收旧历史里的属性。
    const backups = states.map(({ shape, snapshot }): AttributeState => {
      if (shape.document !== document || document.findShape(shape.id) !== shape) {
        throw new Error(`attribute target is no longer in this document: ${shape.id}`);
      }
      snapshot.getValue(shape);
      return { shape, snapshot: shape.captureAttribute(snapshot.attribute) };
    });
    let attempted = 0;
    try {
      for (const { shape, snapshot } of states) {
        // 计入当前对象，即使它在修改后抛错，也要恢复到本次尝试前。
        attempted += 1;
        shape.restoreAttribute(snapshot);
      }
    } catch (error: unknown) {
      const failures: unknown[] = [];
      for (const backup of backups.slice(0, attempted).reverse()) {
        try {
          backup.shape.restoreAttribute(backup.snapshot);
        } catch (rollbackError: unknown) {
          failures.push(rollbackError);
        }
      }
      if (failures.length !== 0) {
        throw new AggregateError([error, ...failures], "attribute rollback failed");
      }
      throw error;
    }
  }
}
