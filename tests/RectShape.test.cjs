// 用途：验证矩形几何语义、失败原子性和局部恢复记录的独立性。
const assert = require("node:assert/strict");
const test = require("node:test");
const { RectShape } = require("../dist/domain/RectShape.js");
const { GeometrySnapshot } = require("../dist/domain/GeometrySnapshot.js");

test("rectangles move their position and scale both position and size", () => {
  const shape = new RectShape("r1", 10, -20, 100, 50);
  assert.equal(shape.id, "r1");
  shape.move(30, 5);
  assert.deepEqual(shape.describe(), {
    id: "r1", kind: "rect", attributes: { x: 40, y: -15, width: 100, height: 50 },
    position: { x: 40, y: -15 },
    geometry: { x: 40, y: -15, width: 100, height: 50 },
  });
  shape.scale(0.5);
  assert.deepEqual(shape.describe().attributes, { x: 20, y: -7.5, width: 50, height: 25 });
  assert.deepEqual(Object.keys(shape.describe().attributes), ["x", "y", "width", "height"]);
});

test("invalid geometry is rejected while zero dimensions and negative positions are valid", () => {
  assert.throws(() => new RectShape("", 0, 0, 1, 1), /id must not be empty/);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => new RectShape("r1", invalid, 0, 1, 1), /finite/);
    assert.throws(() => new RectShape("r1", 0, 0, 1, invalid), /finite/);
  }
  assert.throws(() => new RectShape("r1", 0, 0, -1, 1), /non-negative/);
  assert.throws(() => new RectShape("r1", 0, 0, 1, -1), /non-negative/);
  assert.deepEqual(new RectShape("r1", -10, -20, 0, 0).describe().attributes, {
    x: -10, y: -20, width: 0, height: 0,
  });
});

test("invalid offsets and factors leave geometry unchanged", () => {
  const shape = new RectShape("r1", 10, 20, 100, 50);
  const before = shape.describe();
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => shape.move(999, invalid), /finite/);
    assert.throws(() => shape.move(invalid, 999), /finite/);
    assert.deepEqual(shape.describe(), before);
  }
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => shape.scale(invalid), /scale factor must be positive/);
    assert.deepEqual(shape.describe(), before);
  }
});

test("finite inputs that overflow do not partially move or scale a rectangle", () => {
  const shape = new RectShape("r1", 1, Number.MAX_VALUE, Number.MAX_VALUE, 50);
  const before = shape.describe();
  assert.throws(() => shape.move(999, Number.MAX_VALUE), /finite/);
  assert.deepEqual(shape.describe(), before);
  assert.throws(() => shape.scale(2), /finite/);
  assert.deepEqual(shape.describe(), before);
});

test("local snapshots restore exact before and after values without inverse arithmetic", () => {
  const shape = new RectShape("r1", 0.1, 0.2, 0.3, 0.4);
  const before = shape.describe();
  const oldGeometry = shape.captureGeometry();
  shape.scale(3);
  shape.move(0.2, -0.1);
  const after = shape.describe();
  const newGeometry = shape.captureGeometry();

  shape.restoreGeometry(oldGeometry);
  assert.deepEqual(shape.describe(), before);
  shape.restoreGeometry(newGeometry);
  assert.deepEqual(shape.describe(), after);

  const description = shape.describe();
  description.attributes.x = 999;
  assert.deepEqual(shape.describe(), after);
});

test("snapshots copy their values and reject the wrong object or invalid restoration", () => {
  const shape = new RectShape("r1", 10, 20, 100, 50);
  const before = shape.describe();
  const values = { x: 1, y: 2, width: 3, height: 4 };
  const snapshot = new GeometrySnapshot(shape, values);
  values.x = 999;
  shape.restoreGeometry(snapshot);
  assert.equal(shape.describe().attributes.x, 1);

  const sameId = new RectShape("r1", 10, 20, 100, 50);
  assert.throws(() => sameId.restoreGeometry(snapshot), /another shape/);
  assert.deepEqual(sameId.describe(), before);

  const current = shape.describe();
  for (const invalid of [
    { x: 9, y: 8, width: 7 },
    { x: 9, y: 8, width: 7, height: Infinity },
    { x: 9, y: 8, width: 7, height: -1 },
  ]) {
    assert.throws(() => shape.restoreGeometry(new GeometrySnapshot(shape, invalid)));
    assert.deepEqual(shape.describe(), current);
  }
});
