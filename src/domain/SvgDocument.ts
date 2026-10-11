// 用途：管理画布与有序图形树，受控维护唯一 id、父子关系及文档归属。
import type { CanvasSize } from "./CanvasSize.js";
import type { GroupShape } from "./GroupShape.js";
import { GroupingChange } from "./GroupingChange.js";
import type { SiblingOrder } from "./SiblingOrder.js";
import type { Shape } from "./Shape.js";
import type { PlacementChange } from "./PlacementChange.js";
import type { SubtreeLocation } from "./SubtreeLocation.js";
import { treeMutationToken } from "./internal/TreeMutationToken.js";

export class SvgDocument {
  private width: number;
  private height: number;
  private rootShapes: Shape[] = [];
  // MAP 维护 id 唯一性
  private readonly shapesById = new Map<string, Shape>();

  constructor(width: number, height: number) {
    SvgDocument.validateSize(width, height);
    this.width = width;
    this.height = height;
  }

  getCanvasSize(): CanvasSize {
    // 返回独立描述，调用方无法通过返回对象修改文档。
    return { width: this.width, height: this.height };
  }

  resizeCanvas(width: number, height: number): void {
    // 两个尺寸均通过校验后才写入，避免宽度更新而高度报错。
    SvgDocument.validateSize(width, height);
    this.width = width;
    this.height = height;
  }

  getRootShapes(): readonly Shape[] {
    return [...this.rootShapes];
  }

  findShape(id: string): Shape {
    const shape = this.shapesById.get(id);
    if (shape === undefined) {
      throw new Error(`no such shape: ${id}`);
    }
    return shape;
  }

  findContainer(id: string): GroupShape {
    const shape = this.shapesById.get(id);
    if (shape === undefined) {
      throw new Error(`no such container: ${id}`);
    }
    if (!shape.isContainer()) {
      throw new Error(`not a container: ${id}`);
    }
    return shape;
  }

  insert(shape: Shape, parentId?: string, index?: number): void {
    const parent = parentId === undefined ? undefined : this.findContainer(parentId);
    this.insertSubtree(shape, parent, index);
  }

  remove(id: string): SubtreeLocation {
    const shape = this.findShape(id);
    const parent = shape.parent;
    const siblings = parent === undefined ? this.rootShapes : [...parent.children];
    const index = siblings.indexOf(shape);
    if (index < 0) {
      throw new Error("inconsistent shape tree");
    }
    const nodes = this.collectSubtree(shape);
    const location: SubtreeLocation = { document: this, shape, parent, index };

    const remaining = siblings.filter((sibling) => sibling !== shape);
    this.replaceSiblings(parent, remaining);
    // 只清除摘下根的外部父引用；子树内部父子关系保留以供恢复。
    for (const node of nodes) {
      this.shapesById.delete(node.id);
      node.setTreeContext(treeMutationToken, node === shape ? undefined : node.parent, undefined);
    }
    return location;
  }

  restore(location: SubtreeLocation): void {
    if (location.document !== this) {
      throw new Error("subtree location belongs to another document");
    }
    const parent = location.parent;
    // 同名新容器不能替代原父对象，否则会把撤销记录恢复到错误位置。
    if (parent !== undefined && this.shapesById.get(parent.id) !== parent) {
      throw new Error(`original container is not in this document: ${parent.id}`);
    }
    this.insertSubtree(location.shape, parent, location.index);
  }

  addTo(containerId: string, id: string): PlacementChange {
    const parent = this.findContainer(containerId);
    return this.relocate(this.findShape(id), parent);
  }

  bringToFront(id: string): PlacementChange {
    const shape = this.findShape(id);
    // SVG 后出现的同级节点绘制在上方，front 因而是列表末尾。
    return this.relocate(shape, shape.parent);
  }

  sendToBack(id: string): PlacementChange {
    const shape = this.findShape(id);
    return this.relocate(shape, shape.parent, 0);
  }

  restorePlacement(location: SubtreeLocation): void {
    if (location.document !== this) {
      throw new Error("subtree location belongs to another document");
    }
    // 活动对象换位与已删除子树接回使用不同入口，不能互相代替。
    this.relocate(location.shape, location.parent, location.index);
  }

  group(group: GroupShape, memberIds: readonly string[]): GroupingChange {
    if (this.shapesById.has(group.id)) {
      throw new Error(`id already exists: ${group.id}`);
    }
    if (group.document !== undefined || group.parent !== undefined || group.children.length !== 0) {
      throw new Error("new group must be an empty detached container");
    }
    if (memberIds.length === 0) {
      throw new Error("group requires at least one member");
    }
    const members = new Set<Shape>();
    for (const id of memberIds) {
      const member = this.findShape(id);
      if (members.has(member)) {
        throw new Error(`duplicate group member: ${id}`);
      }
      members.add(member);
    }
    for (const member of members) {
      for (let ancestor = member.parent; ancestor !== undefined; ancestor = ancestor.parent) {
        if (members.has(ancestor)) {
          throw new Error(`cannot group a container into its own descendant: ${ancestor.id}`);
        }
      }
    }

    // 按原文档的先序遍历收编，不按命令参数顺序重新排列成员。
    const ordered = this.rootShapes.flatMap((root) => this.collectSubtree(root))
      .filter((shape) => members.has(shape));
    const parent = this.commonParent(ordered);
    const parents = new Set<GroupShape | undefined>([parent, group]);
    for (const member of ordered) {
      parents.add(member.parent);
    }
    const before: SiblingOrder[] = [...parents].map((owner) => ({ parent: owner, children: this.siblingsOf(owner) }));
    const after = before.map((order): SiblingOrder => {
      if (order.parent === group) {
        return { parent: group, children: ordered };
      }
      const children = order.children.filter((child) => !members.has(child));
      if (order.parent === parent) {
        children.push(group);
      }
      return { parent: order.parent, children };
    });
    const change = new GroupingChange(this, group, false, before, after);
    this.restoreGrouping(change, true);
    return change;
  }

  ungroup(id: string): GroupingChange {
    const group = this.findContainer(id);
    const parent = group.parent;
    if (parent === undefined) {
      throw new Error(`cannot ungroup top-level container: ${id}`);
    }
    const siblings = this.siblingsOf(parent);
    const index = siblings.indexOf(group);
    if (index < 0) {
      throw new Error("inconsistent shape tree");
    }
    const children = group.children;
    const updated = [...siblings];
    // 子节点原地替换组，前后兄弟及组内成员的顺序均保持不变。
    updated.splice(index, 1, ...children);
    const change = new GroupingChange(this, group, true,
      [{ parent, children: siblings }, { parent: group, children }],
      [{ parent, children: updated }, { parent: group, children: [] }],
    );
    this.restoreGrouping(change, true);
    return change;
  }

  restoreGrouping(change: GroupingChange, after: boolean): void {
    const source = change.getOrders(this, !after);
    const target = change.getOrders(this, after);
    const group = change.group;
    const present = change.isGroupPresent(after);
    if (change.isGroupPresent(!after)) {
      this.requireActiveShape(group);
    } else {
      if (this.shapesById.has(group.id)) {
        throw new Error(`id already exists: ${group.id}`);
      }
      if (group.document !== undefined || group.parent !== undefined || group.children.length !== 0) {
        throw new Error("original group is not detached and empty");
      }
    }

    // 恢复前核对全部受影响列表和原对象，不能恢复一半才发现另一父容器已变化。
    const oldNodes = new Set<Shape>();
    const placements = new Map<Shape, GroupShape | undefined>();
    if (source.length !== target.length) {
      throw new Error("invalid grouping change");
    }
    for (const [index, order] of source.entries()) {
      const next = target[index];
      if (next === undefined || next.parent !== order.parent) {
        throw new Error("invalid grouping change");
      }
      if (order.parent !== undefined) {
        const parentId = order.parent.id;
        if (!order.parent.isContainer()) {
          throw new Error(`not a container: ${parentId}`);
        }
      }
      if (order.parent !== undefined && order.parent !== group) {
        this.requireActiveShape(order.parent);
      }
      const current = this.siblingsOf(order.parent);
      if (current.length !== order.children.length || current.some((child, i) => child !== order.children[i])) {
        throw new Error("group structure changed since grouping command");
      }
      for (const child of order.children) {
        this.requireActiveShape(child);
        oldNodes.add(child);
      }
      for (const child of next.children) {
        if (placements.has(child)) {
          throw new Error("invalid grouping change: repeated node");
        }
        placements.set(child, next.parent);
      }
      if (!present && next.parent === group && next.children.length !== 0) {
        throw new Error("detached group must be empty");
      }
    }
    if (placements.has(group) !== present) {
      throw new Error("invalid group placement");
    }
    // 除了组本身的接入/移除，其余节点必须完整保留，不能重复或丢失。
    for (const node of oldNodes) {
      if (node !== group && !placements.has(node)) {
        throw new Error("invalid grouping change: missing node");
      }
    }
    for (const node of placements.keys()) {
      if (node !== group && !oldNodes.has(node)) {
        throw new Error("invalid grouping change: unexpected node");
      }
      const seen = new Set<Shape>([node]);
      let ancestor = placements.get(node);
      while (ancestor !== undefined) {
        if (seen.has(ancestor) || (!present && ancestor === group)) {
          throw new Error("grouping change would create an invalid tree");
        }
        seen.add(ancestor);
        ancestor = placements.has(ancestor) ? placements.get(ancestor) : ancestor.parent;
      }
    }

    // 校验完成后一次应用局部计划；成员子孙和几何不变，仅切换组的活动索引。
    for (const order of target) {
      this.replaceSiblings(order.parent, order.children);
    }
    for (const [node, parent] of placements) {
      node.setTreeContext(treeMutationToken, parent, this);
    }
    if (present) {
      this.shapesById.set(group.id, group);
    } else {
      this.shapesById.delete(group.id);
      group.setTreeContext(treeMutationToken, undefined, undefined);
    }
  }

  private commonParent(members: readonly Shape[]): GroupShape | undefined {
    let candidate = members[0]?.parent;
    while (candidate !== undefined) {
      const current = candidate;
      const shared = members.every((member) => {
        for (let ancestor = member.parent; ancestor !== undefined; ancestor = ancestor.parent) {
          if (ancestor === current) {
            return true;
          }
        }
        return false;
      });
      if (shared) {
        return current;
      }
      candidate = current.parent;
    }
    return undefined;
  }

  private requireActiveShape(shape: Shape): void {
    if (this.shapesById.get(shape.id) !== shape || shape.document !== this) {
      throw new Error(`original shape is not in this document: ${shape.id}`);
    }
  }

  private relocate(shape: Shape, parent: GroupShape | undefined, index?: number): PlacementChange {
    if (this.shapesById.get(shape.id) !== shape || shape.document !== this) {
      throw new Error(`original shape is not in this document: ${shape.id}`);
    }
    if (parent !== undefined && (this.shapesById.get(parent.id) !== parent || parent.document !== this)) {
      throw new Error(`original container is not in this document: ${parent.id}`);
    }
    if (parent !== undefined) {
      const parentId = parent.id;
      if (!parent.isContainer()) {
        throw new Error(`not a container: ${parentId}`);
      }
    }
    // 沿目标父容器的祖先链检查，既拒绝移入自身，也拒绝移入自己的子孙。
    for (let ancestor = parent; ancestor !== undefined; ancestor = ancestor.parent) {
      if (ancestor === shape) {
        throw new Error(`cannot move a shape into itself or its descendant: ${shape.id}`);
      }
    }

    const oldParent = shape.parent;
    const oldSiblings = this.siblingsOf(oldParent);
    const oldIndex = oldSiblings.indexOf(shape);
    if (oldIndex < 0) {
      throw new Error("inconsistent shape tree");
    }
    const remaining = oldSiblings.filter((sibling) => sibling !== shape);
    // 同父换位必须先排除自身；index 表示换位完成后的索引。
    const targetSiblings = parent === oldParent ? remaining : this.siblingsOf(parent);
    const position = index ?? targetSiblings.length;
    if (!Number.isInteger(position) || position < 0 || position > targetSiblings.length) {
      throw new Error("invalid child position");
    }
    const updated = [...targetSiblings];
    updated.splice(position, 0, shape);
    const change: PlacementChange = {
      before: { document: this, shape, parent: oldParent, index: oldIndex },
      after: { document: this, shape, parent, index: position },
    };

    // 所有校验和列表计算完成后才写入；子孙归属、几何和 id 索引保持原样。
    if (parent !== oldParent) {
      this.replaceSiblings(oldParent, remaining);
    }
    this.replaceSiblings(parent, updated);
    shape.setTreeContext(treeMutationToken, parent, this);
    return change;
  }

  private siblingsOf(parent: GroupShape | undefined): readonly Shape[] {
    return parent === undefined ? [...this.rootShapes] : parent.children;
  }

  // 插入子树
  private insertSubtree(shape: Shape, parent: GroupShape | undefined, index?: number): void {
    const siblings = parent === undefined ? this.rootShapes : [...parent.children];
    const position = index ?? siblings.length;
    // 检查插入位置合法性，避免越界或负数。
    if (!Number.isInteger(position) || position < 0 || position > siblings.length) {
      throw new Error("invalid child position");
    }

    const nodes = this.collectSubtree(shape);
    for (const node of nodes) {
      if (this.shapesById.has(node.id)) {
        throw new Error(`id already exists: ${node.id}`);
      }
      if (node.document !== undefined) {
        throw new Error(`shape already belongs to a document: ${node.id}`);
      }
    }
    if (shape.parent !== undefined) {
      throw new Error(`shape already has a parent: ${shape.id}`);
    }

    // 整棵子树与插入位置验证完成后，同步写入列表、父引用、归属与索引。
    const updated = [...siblings];
    updated.splice(position, 0, shape);
    this.replaceSiblings(parent, updated);
    for (const node of nodes) {
      // 内部父子关系保留，外部父引用更新为新父对象或 undefined。
      node.setTreeContext(treeMutationToken, node === shape ? parent : node.parent, this);
      this.shapesById.set(node.id, node);
    }
  }

  private replaceSiblings(parent: GroupShape | undefined, children: readonly Shape[]): void {
    if (parent === undefined) {
      this.rootShapes = [...children];
    } else {
      parent.replaceChildren(treeMutationToken, children);
    }
  }

  private collectSubtree(root: Shape): readonly Shape[] {
    const nodes: Shape[] = [];
    const seen = new Set<Shape>();
    const ids = new Set<string>();
    const visit = (shape: Shape): void => {
      if (seen.has(shape)) {
        throw new Error("shape tree contains a cycle or repeated node");
      }
      if (ids.has(shape.id)) {
        throw new Error(`id already exists: ${shape.id}`);
      }
      seen.add(shape);
      ids.add(shape.id);
      nodes.push(shape);
      const children = shape.children;
      if (children.length !== 0 && !shape.isContainer()) {
        throw new Error(`not a container: ${shape.id}`);
      }
      for (const child of children) {
        if (child.parent !== shape) {
          throw new Error("inconsistent parent and child references");
        }
        visit(child);
      }
    };
    visit(root);
    return nodes;
  }

  private static validateSize(width: number, height: number): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new Error("canvas dimensions must be finite and positive");
    }
  }
}
