// 用途：验证新增叶子的几何语义、失败原子性、样式保留及局部恢复。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CircleShape } = require("../dist/domain/CircleShape.js");
const { EllipseShape } = require("../dist/domain/EllipseShape.js");
const { LineShape } = require("../dist/domain/LineShape.js");
const { TextShape } = require("../dist/domain/TextShape.js");
const { GeometrySnapshot } = require("../dist/domain/GeometrySnapshot.js");

const examples = [
  {
    kind: "circle", make: (styles) => new CircleShape("c1", 1, 2, 3, styles),
    moved: { cx: 6, cy: -3, r: 3 }, scaled: { cx: 12, cy: -6, r: 6 },
    overflow: () => new CircleShape("c1", 1, Number.MAX_VALUE, Number.MAX_VALUE),
  },
  {
    kind: "ellipse", make: (styles) => new EllipseShape("e1", 1, 2, 3, 4, styles),
    moved: { cx: 6, cy: -3, rx: 3, ry: 4 }, scaled: { cx: 12, cy: -6, rx: 6, ry: 8 },
    overflow: () => new EllipseShape("e1", 1, Number.MAX_VALUE, Number.MAX_VALUE, 4),
  },
  {
    kind: "line", make: (styles) => new LineShape("l1", 1, 2, 3, 4, styles),
    moved: { x1: 6, y1: -3, x2: 8, y2: -1 }, scaled: { x1: 12, y1: -6, x2: 16, y2: -2 },
    overflow: () => new LineShape("l1", 1, 2, Number.MAX_VALUE, Number.MAX_VALUE),
  },
  {
    kind: "text", make: (styles) => new TextShape("t1", 1, 2, '  in #fff <&> "文字"  ', styles),
    moved: { x: 6, y: -3 }, scaled: { x: 12, y: -6 },
    overflow: () => new TextShape("t1", 1, Number.MAX_VALUE, "content"),
  },
];

for (const example of examples) {
  test(`${example.kind} moves, scales, and restores geometry while preserving styles and text`, () => {
    const styles = { fill: "#abc", stroke: "black", strokeWidth: 2 };
    const shape = example.make(styles);
    const before = shape.describe();
    const oldGeometry = shape.captureGeometry();
    const expectedStyles = { fill: "#abc", stroke: "black", "stroke-width": 2 };
    styles.fill = "red";

    shape.move(5, -5);
    assert.deepEqual(shape.describe().attributes, { ...example.moved, ...expectedStyles });
    shape.scale(2);
    assert.deepEqual(shape.describe().attributes, { ...example.scaled, ...expectedStyles });
    assert.equal(shape.describe().text, before.text);
    const after = shape.describe();
    const newGeometry = shape.captureGeometry();
    shape.restoreGeometry(oldGeometry);
    assert.deepEqual(shape.describe(), before);
    shape.restoreGeometry(newGeometry);
    assert.deepEqual(shape.describe(), after);

    const description = shape.describe();
    description.attributes.fill = "blue";
    assert.deepEqual(shape.describe(), after);
  });

  test(`${example.kind} rejects invalid operations and computed overflow without partial changes`, () => {
    const shape = example.make();
    const before = shape.describe();
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assert.throws(() => shape.move(99, invalid), /finite/);
      assert.throws(() => shape.move(invalid, 99), /finite/);
      assert.deepEqual(shape.describe(), before);
    }
    for (const invalid of [0, -1, NaN, Infinity]) {
      assert.throws(() => shape.scale(invalid), /scale factor must be positive/);
      assert.deepEqual(shape.describe(), before);
    }
    assert.throws(() => shape.restoreGeometry(example.make().captureGeometry()), /another shape/);
    const invalidValues = Object.fromEntries(Object.keys(before.attributes).map((name) => [name, Infinity]));
    assert.throws(() => shape.restoreGeometry(new GeometrySnapshot(shape, invalidValues)), /snapshot value/);
    assert.deepEqual(shape.describe(), before);

    const large = example.overflow();
    const original = large.describe();
    assert.throws(() => large.move(5, Number.MAX_VALUE), /finite/);
    assert.deepEqual(large.describe(), original);
    assert.throws(() => large.scale(2), /finite/);
    assert.deepEqual(large.describe(), original);
  });
}

test("radii cannot be negative, zero radii are valid, and all constructors reject non-finite geometry", () => {
  assert.throws(() => new CircleShape("c1", 0, 0, -1), /non-negative/);
  assert.throws(() => new EllipseShape("e1", 0, 0, -1, 1), /non-negative/);
  assert.throws(() => new EllipseShape("e1", 0, 0, 1, -1), /non-negative/);
  assert.equal(new CircleShape("c1", -1, -2, 0).describe().attributes.r, 0);
  assert.equal(new EllipseShape("e1", -1, -2, 0, 0).describe().attributes.ry, 0);
  assert.equal(new TextShape("t1", 0, 0, "").describe().text, "");
  assert.throws(() => new CircleShape("c1", 0, NaN, 1), /finite/);
  assert.throws(() => new EllipseShape("e1", 0, 0, 1, Infinity), /finite/);
  assert.throws(() => new LineShape("l1", 0, 0, 1, Infinity), /finite/);
  assert.throws(() => new TextShape("t1", 0, NaN, "text"), /finite/);
});
