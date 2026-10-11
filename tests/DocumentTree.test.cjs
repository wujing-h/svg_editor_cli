// 用途：验证文档树的唯一 id、归属、顺序和子树移除/恢复的失败原子性。
const assert = require("node:assert/strict");
const test = require("node:test");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { GroupShape } = require("../dist/domain/GroupShape.js");
const { RectShape } = require("../dist/domain/RectShape.js");

test("nested insertion maintains parents, ownership, unique lookup, and ordered children", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const nested = new GroupShape("nested");
  const first = new RectShape("r1", 1, 2, 3, 4);
  const second = new RectShape("R1", 5, 6, 7, 8);
  document.insert(group);
  document.insert(nested, "scene");
  document.insert(first, "nested");
  document.insert(second, "nested", 0);

  assert.deepEqual(document.getRootShapes(), [group]);
  assert.deepEqual(group.children, [nested]);
  assert.deepEqual(nested.children, [second, first]);
  assert.equal(group.parent, undefined);
  assert.equal(nested.parent, group);
  assert.equal(first.parent, nested);
  for (const shape of [group, nested, first, second]) {
    assert.equal(shape.document, document);
    assert.equal(document.findShape(shape.id), shape);
  }
  assert.equal(document.findContainer("nested"), nested);

  document.getRootShapes().pop();
  nested.children.reverse();
  group.describe().children.length = 0;
  assert.deepEqual(document.getRootShapes(), [group]);
  assert.deepEqual(nested.children, [second, first]);
  assert.deepEqual(group.children, [nested]);
});

test("removing and restoring a subtree preserves internal relations and its original position", () => {
  const document = new SvgDocument(800, 600);
  const before = new RectShape("before", 0, 0, 1, 1);
  const group = new GroupShape("scene");
  const nested = new GroupShape("nested");
  const leaf = new RectShape("leaf", 0, 0, 1, 1);
  const after = new RectShape("after", 0, 0, 1, 1);
  document.insert(before);
  document.insert(group);
  document.insert(after);
  document.insert(nested, "scene");
  document.insert(leaf, "nested");

  const location = document.remove("scene");
  assert.equal(location.index, 1);
  assert.deepEqual(document.getRootShapes(), [before, after]);
  assert.equal(group.parent, undefined);
  assert.equal(nested.parent, group);
  assert.equal(leaf.parent, nested);
  for (const shape of [group, nested, leaf]) {
    assert.equal(shape.document, undefined);
    assert.throws(() => document.findShape(shape.id), /no such shape/);
  }

  document.restore(location);
  assert.deepEqual(document.getRootShapes(), [before, group, after]);
  for (const shape of [group, nested, leaf]) {
    assert.equal(shape.document, document);
    assert.equal(document.findShape(shape.id), shape);
  }

  const leafLocation = document.remove("leaf");
  assert.equal(leafLocation.parent, nested);
  assert.equal(leaf.parent, undefined);
  assert.deepEqual(nested.children, []);
  document.restore(leafLocation);
  assert.equal(leaf.parent, nested);
  assert.deepEqual(nested.children, [leaf]);
});

test("duplicate ids anywhere in a subtree reject insertion before any state changes", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const leaf = new RectShape("r1", 0, 0, 1, 1);
  document.insert(group);
  document.insert(leaf, "scene");
  const location = document.remove("scene");
  const conflicting = new RectShape("r1", 9, 9, 1, 1);
  document.insert(conflicting);

  assert.throws(() => document.restore(location), /id already exists: r1/);
  assert.deepEqual(document.getRootShapes(), [conflicting]);
  assert.equal(group.document, undefined);
  assert.equal(leaf.document, undefined);
  assert.equal(leaf.parent, group);
  assert.throws(() => document.findShape("scene"), /no such shape/);
  assert.equal(document.findShape("r1"), conflicting);

  document.remove("r1");
  document.restore(location);
  assert.equal(document.findShape("r1"), leaf);
  const duplicate = new RectShape("r1", 1, 1, 1, 1);
  assert.throws(() => document.insert(duplicate, "scene"), /id already exists: r1/);
  assert.deepEqual(group.children, [leaf]);
  assert.equal(duplicate.document, undefined);
  assert.equal(duplicate.parent, undefined);
});

test("invalid parents, positions, missing ids, and attempted cycles preserve the tree", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const nested = new GroupShape("nested");
  const leaf = new RectShape("r1", 0, 0, 1, 1);
  document.insert(group);
  document.insert(nested, "scene");
  document.insert(leaf, "nested");
  const before = group.describe();
  const candidate = new RectShape("r2", 0, 0, 1, 1);

  assert.throws(() => document.insert(candidate, "missing"), /no such container: missing/);
  assert.throws(() => document.insert(candidate, "r1"), /not a container: r1/);
  for (const invalid of [-1, 0.5, 2, NaN, Infinity]) {
    assert.throws(() => document.insert(candidate, "nested", invalid), /invalid child position/);
  }
  assert.throws(() => document.insert(group, "nested"));
  assert.throws(() => document.insert(group, "scene"));
  assert.throws(() => document.insert(leaf, "scene"));
  assert.throws(() => document.remove("missing"), /no such shape: missing/);
  assert.equal(candidate.document, undefined);
  assert.equal(candidate.parent, undefined);
  assert.deepEqual(group.describe(), before);
  assert.equal(group.parent, undefined);
  assert.equal(nested.parent, group);
  assert.equal(leaf.parent, nested);
  assert.deepEqual(document.getRootShapes(), [group]);
});

test("an active subtree cannot belong to two documents and foreign restore records are rejected", () => {
  const first = new SvgDocument(800, 600);
  const second = new SvgDocument(400, 300);
  const group = new GroupShape("scene");
  const leaf = new RectShape("r1", 0, 0, 1, 1);
  first.insert(group);
  first.insert(leaf, "scene");

  assert.throws(() => second.insert(group), /already belongs to a document/);
  assert.deepEqual(second.getRootShapes(), []);
  assert.equal(first.findShape("r1"), leaf);
  assert.equal(leaf.document, first);

  const location = first.remove("scene");
  assert.throws(() => second.restore(location), /another document/);
  second.insert(group);
  assert.equal(group.document, second);
  assert.equal(leaf.document, second);
  assert.equal(second.findShape("r1"), leaf);
  assert.throws(() => first.restore(location), /already belongs to a document/);
  assert.deepEqual(first.getRootShapes(), []);
  assert.deepEqual(second.getRootShapes(), [group]);
});

test("restore requires the original parent object, not a new container with the same id", () => {
  const document = new SvgDocument(800, 600);
  const original = new GroupShape("scene");
  const leaf = new RectShape("r1", 0, 0, 1, 1);
  document.insert(original);
  document.insert(leaf, "scene");
  const leafLocation = document.remove("r1");
  const groupLocation = document.remove("scene");
  const replacement = new GroupShape("scene");
  document.insert(replacement);

  assert.throws(() => document.restore(leafLocation), /original container/);
  assert.deepEqual(replacement.children, []);
  assert.equal(leaf.parent, undefined);
  assert.equal(leaf.document, undefined);
  document.remove("scene");
  document.restore(groupLocation);
  document.restore(leafLocation);
  assert.equal(leaf.parent, original);
});

test("structure write methods reject callers without the document's internal token", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const leaf = new RectShape("r1", 0, 0, 1, 1);
  document.insert(group);
  document.insert(leaf, "scene");
  assert.throws(() => group.replaceChildren(Symbol("wrong token"), []), /through SvgDocument/);
  assert.throws(() => leaf.setTreeContext(Symbol("wrong token"), undefined, undefined), /through SvgDocument/);
  assert.equal(leaf.parent, group);
  assert.equal(leaf.document, document);
  assert.deepEqual(group.children, [leaf]);
});
