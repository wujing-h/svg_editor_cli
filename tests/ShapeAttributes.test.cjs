// 用途：验证各图形的属性白名单、范围约束及单属性快照恢复。
const assert = require("node:assert/strict");
const test = require("node:test");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { AttributeSnapshot } = require("../dist/domain/AttributeSnapshot.js");

const examples = [
  { kind: "rect", parameters: ["1", "2", "3", "4"], changes: { x: -0.5, y: 0, width: 0, height: 10 }, other: "cx" },
  { kind: "circle", parameters: ["1", "2", "3"], changes: { cx: -0.5, cy: 0, r: 0 }, other: "x" },
  { kind: "ellipse", parameters: ["1", "2", "3", "4"], changes: { cx: -0.5, cy: 0, rx: 0, ry: 10 }, other: "r" },
  { kind: "line", parameters: ["1", "2", "3", "4"], changes: { x1: -0.5, y1: 0, x2: 10, y2: -10 }, other: "x" },
  { kind: "text", parameters: ["1", "2", "原文"], changes: { x: -0.5, y: 0 }, other: "r" },
];

for (const example of examples) {
  test(`${example.kind} sets and restores every supported geometry field independently`, () => {
    const shape = new ShapeFactory().createFromParameters(example.kind, "s1", example.parameters);
    for (const [attribute, value] of Object.entries(example.changes)) {
      const before = shape.describe();
      const snapshot = shape.captureAttribute(attribute);
      shape.setAttribute(attribute, String(value));
      assert.deepEqual(shape.describe().attributes, { ...before.attributes, [attribute]: value });
      assert.equal(shape.describe().text, before.text);
      shape.restoreAttribute(snapshot);
      assert.deepEqual(shape.describe(), before);
      shape.setAttribute(attribute, value);
      assert.equal(shape.describe().attributes[attribute], value);
      shape.restoreAttribute(snapshot);
    }
  });
}

test("common styles on all six types restore absence, empty strings, none, and zero exactly", () => {
  const factory = new ShapeFactory();
  const shapes = examples.map((example) => factory.createFromParameters(example.kind, "s1", example.parameters));
  shapes.push(factory.create("g", "g1"));
  for (const shape of shapes) {
    for (const [attribute, value] of [["fill", "none"], ["stroke", ""], ["stroke-width", 0]]) {
      const before = shape.describe();
      const absent = shape.captureAttribute(attribute);
      assert.equal(absent.getValue(shape), undefined);
      shape.setAttribute(attribute, value);
      const present = shape.captureAttribute(attribute);
      assert.equal(present.getValue(shape), value);
      shape.restoreAttribute(absent);
      assert.equal(Object.hasOwn(shape.describe().attributes, attribute), false);
      assert.deepEqual(shape.describe(), before);
      shape.restoreAttribute(present);
      assert.equal(shape.describe().attributes[attribute], value);
      shape.restoreAttribute(absent);
    }
  }
});

test("unsupported and structural attributes never change any shape", () => {
  const factory = new ShapeFactory();
  for (const example of [...examples, { kind: "g", parameters: [], other: "x" }]) {
    const shape = factory.createFromParameters(example.kind, "s1", example.parameters);
    const before = shape.describe();
    const names = [example.other, "id", "kind", "parent", "children", "transform", "style", "font-size", "toString", "__proto__"];
    if (example.kind !== "text") {
      names.push("text");
    }
    for (const attribute of names) {
      assert.throws(() => shape.captureAttribute(attribute), { message: `unknown attribute: ${attribute}` });
      assert.throws(() => shape.setAttribute(attribute, "1"), { message: `unknown attribute: ${attribute}` });
      assert.deepEqual(shape.describe(), before);
    }
  }
});

test("invalid geometry, stroke width, paints, and text values leave state unchanged", () => {
  const factory = new ShapeFactory();
  for (const [kind, attributes, attribute] of [
    ["rect", { x: 1, y: 2, width: 3, height: 4 }, "width"],
    ["circle", { cx: 1, cy: 2, r: 3 }, "r"],
    ["ellipse", { cx: 1, cy: 2, rx: 3, ry: 4 }, "ry"],
  ]) {
    const shape = factory.create(kind, "s1", attributes);
    const before = shape.describe();
    for (const value of [-1, "NaN", Infinity, "1e309", "0x20", "1px", "", " "]) {
      assert.throws(() => shape.setAttribute(attribute, value));
      assert.deepEqual(shape.describe(), before);
    }
  }
  const text = factory.create("text", "t1", { x: 1, y: 2 }, "原文");
  const before = text.describe();
  for (const [attribute, value] of [["stroke-width", -1], ["stroke-width", Infinity], ["fill", 1], ["stroke", 0], ["text", 123], ["x", "NaN"]]) {
    assert.throws(() => text.setAttribute(attribute, value));
    assert.deepEqual(text.describe(), before);
  }
  text.setAttribute("x", "-2e2");
  assert.equal(text.describe().attributes.x, -200);
  text.setAttribute("stroke-width", ".5");
  assert.equal(text.describe().attributes["stroke-width"], 0.5);
});

test("attribute snapshots bind to the original object and restore only one valid property", () => {
  const factory = new ShapeFactory();
  const shape = factory.create("rect", "r1", { x: 1, y: 2, width: 3, height: 4 });
  const snapshot = shape.captureAttribute("x");
  shape.setAttribute("x", 10);
  shape.setAttribute("y", 20);
  shape.restoreAttribute(snapshot);
  assert.deepEqual(shape.describe().attributes, { x: 1, y: 20, width: 3, height: 4 });
  const replacement = factory.create("rect", "r1", { x: 5, y: 6, width: 7, height: 8 });
  const before = replacement.describe();
  assert.throws(() => replacement.restoreAttribute(snapshot), /another shape/);
  assert.deepEqual(replacement.describe(), before);
  for (const invalid of [
    new AttributeSnapshot(shape, "width", -1),
    new AttributeSnapshot(shape, "x", NaN),
    new AttributeSnapshot(shape, "x", undefined),
    new AttributeSnapshot(shape, "id", "changed"),
  ]) {
    const current = shape.describe();
    assert.throws(() => shape.restoreAttribute(invalid));
    assert.deepEqual(shape.describe(), current);
  }
});
