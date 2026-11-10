// 用途：选择唯一属性策略，无匹配时保留原白名单，并把整次修改交给局部事务。
import type { AttributeChange } from "./AttributeChange.js";
import { AttributeTransaction } from "./AttributeTransaction.js";
import type { AttributeHandler } from "./contracts/AttributeHandler.js";
import type { CommandResult } from "./contracts/CommandResult.js";
import type { Shape } from "../domain/Shape.js";
import type { SvgDocument } from "../domain/SvgDocument.js";

export interface AttributeOperation {
  readonly change: AttributeChange;
  readonly beforeResult: CommandResult;
  readonly afterResult: CommandResult;
}

export class AttributeService {
  private readonly getHandlers: () => readonly AttributeHandler[];

  constructor(getHandlers: () => readonly AttributeHandler[] = () => []) {
    this.getHandlers = getHandlers;
  }

  apply(document: SvgDocument, shape: Shape, attribute: string, value: string): AttributeOperation {
    const transaction = new AttributeTransaction(document);
    try {
      const description = transaction.getShape(shape.id);
      const matches = this.getHandlers().filter((handler) => {
        const match: unknown = handler.handles(description, attribute);
        this.requireSynchronous(match);
        if (typeof match !== "boolean") {
          throw new Error(`invalid attribute handler match: ${handler.name}`);
        }
        return match;
      });
      if (matches.length > 1) {
        throw new Error(`multiple attribute handlers: ${shape.id}/${attribute} (${matches.map((handler) => handler.name).join(", ")})`);
      }
      const handler = matches[0];
      let beforeResult: CommandResult;
      let afterResult: CommandResult;
      if (handler === undefined) {
        const before = shape.captureAttribute(attribute);
        transaction.setAttribute(shape.id, attribute, value);
        const after = shape.captureAttribute(attribute);
        beforeResult = { attributeChange: { kind: shape.type, id: shape.id, attribute, value: before.getValue(shape) } };
        afterResult = { attributeChange: { kind: shape.type, id: shape.id, attribute, value: after.getValue(shape) } };
      } else {
        const result: unknown = handler.apply(transaction.context, description, attribute, value);
        this.requireSynchronous(result);
        // 虚拟属性不一定存在于目标自身；提示描述逻辑操作，不冒充某个子部件的旧值。
        beforeResult = { summary: { template: "{kind}#{id} update undone: {attribute}",
          values: { kind: shape.type, id: shape.id, attribute } } };
        afterResult = { attributeChange: { kind: shape.type, id: shape.id, attribute, value } };
      }
      return { change: transaction.commit(), beforeResult, afterResult };
    } catch (error: unknown) {
      transaction.rollback();
      throw error;
    }
  }

  private requireSynchronous(result: unknown): void {
    if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
      void Promise.resolve(result).catch(() => undefined);
      throw new Error("attribute handlers must execute synchronously");
    }
  }
}
