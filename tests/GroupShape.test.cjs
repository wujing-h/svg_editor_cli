// 用途：验证嵌套容器的统一几何操作、整组失败原子性及局部恢复。
const assert = require("node:assert/strict");
const test = require("node:test");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { GroupShape } = require("../dist/domain/GroupShape.js");
const { RectShape } = require("../dist/domain/RectShape.js");
const { GeometrySnapshot } = require("../dist/domain/GeometrySnapshot.js");

test("nested groups delegate movement, scaling, and exact restoration through Shape operations", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const nested = new GroupShape("nested");
  const first = new RectShape("r1", 10, 20, 30, 40);
  const second = new RectShape("r2", 1, 2, 3, 4);
  document.insert(group);
  document.insert(first, "scene");
  document.insert(nested, "scene");
  document.insert(second, "nested");
  const before = group.describe();
  const snapshot = group.captureGeometry();

  group.move(5, -5);
  group.scale(2);
  assert.deepEqual(first.describe().attributes, { x: 30, y: 30, width: 60, height: 80 });
  assert.deepEqual(second.describe().attributes, { x: 12, y: -6, width: 6, height: 8 });
  assert.deepEqual(group.describe().attributes, {});
  group.restoreGeometry(snapshot);
  assert.deepEqual(group.describe(), before);
  assert.equal(second.parent, nested);
  assert.equal(second.document, document);
});

test("a later nested child's overflow prevents all earlier children from changing", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const nested = new GroupShape("nested");
  document.insert(group);
  document.insert(new RectShape("r1", 1, 2, 3, 4), "scene");
  document.insert(nested, "scene");
  document.insert(new RectShape("r2", 1, Number.MAX_VALUE, Number.MAX_VALUE, 4), "nested");
  const before = group.describe();

  assert.throws(() => group.move(5, Number.MAX_VALUE), /finite/);
  assert.deepEqual(group.describe(), before);
  assert.throws(() => group.scale(2), /finite/);
  assert.deepEqual(group.describe(), before);
});

test("empty groups also reject invalid movement and scale parameters", () => {
  const group = new GroupShape("empty");
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => group.move(0, invalid), /finite/);
  }
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => group.scale(invalid), /scale factor must be positive/);
  }
  group.move(1, 2);
  group.scale(2);
  group.restoreGeometry(group.captureGeometry());
  assert.deepEqual(group.children, []);
});

test("invalid restoration of a later child leaves the whole group's geometry unchanged", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const first = new RectShape("r1", 1, 2, 3, 4);
  const second = new RectShape("r2", 5, 6, 7, 8);
  document.insert(group);
  document.insert(first, "scene");
  document.insert(second, "scene");
  const before = group.describe();
  const states = [
    new GeometrySnapshot(first, { x: 99, y: 98, width: 97, height: 96 }),
    new GeometrySnapshot(second, { x: 1, y: 2, width: 3, height: -1 }),
  ];
  const snapshot = new GeometrySnapshot(group, {}, states);
  states.length = 0;
  snapshot.getChildren(group).length = 0;
  assert.throws(() => group.restoreGeometry(snapshot), /non-negative/);
  assert.deepEqual(group.describe(), before);
});

test("geometry restoration rejects changed membership, order, and same-id replacements", () => {
  const document = new SvgDocument(800, 600);
  const group = new GroupShape("scene");
  const first = new RectShape("r1", 1, 2, 3, 4);
  const second = new RectShape("r2", 5, 6, 7, 8);
  document.insert(group);
  document.insert(first, "scene");
  document.insert(second, "scene");
  const snapshot = group.captureGeometry();
  const location = document.remove("r1");
  assert.throws(() => group.restoreGeometry(snapshot), /group structure changed/);
  document.insert(first, "scene");
  const reordered = group.describe();
  assert.throws(() => group.restoreGeometry(snapshot), /another shape/);
  assert.deepEqual(group.describe(), reordered);

  document.remove("r1");
  document.restore(location);
  document.remove("r1");
  document.insert(new RectShape("r1", 99, 98, 97, 96), "scene", 0);
  const replacement = group.describe();
  assert.throws(() => group.restoreGeometry(snapshot), /another shape/);
  assert.deepEqual(group.describe(), replacement);
});
