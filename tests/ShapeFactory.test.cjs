// 用途：验证六种图形的集中创建、输入校验、可选样式和文本保留。
const assert = require("node:assert/strict");
const test = require("node:test");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");

const examples = [
  { kind: "rect", params: ["1", "2", "3", "4", "#abc"], attributes: { x: 1, y: 2, width: 3, height: 4, fill: "#abc" } },
  { kind: "circle", params: ["-1", "2", ".5", "red"], attributes: { cx: -1, cy: 2, r: 0.5, fill: "red" } },
  { kind: "ellipse", params: ["1", "2", "3", "4"], attributes: { cx: 1, cy: 2, rx: 3, ry: 4 } },
  { kind: "line", params: ["1", "2", "-3", "-4", "black"], attributes: { x1: 1, y1: 2, x2: -3, y2: -4, stroke: "black" } },
  { kind: "text", params: ["1", "2", '  in #fff <&> "文字"  '], attributes: { x: 1, y: 2 }, text: '  in #fff <&> "文字"  ' },
  { kind: "g", params: [], attributes: {} },
];

for (const example of examples) {
  test(`factory creates ${example.kind} consistently from parameters and attributes`, () => {
    const factory = new ShapeFactory();
    const shape = factory.createFromParameters(example.kind, "s1", example.params);
    assert.equal(shape.kind, example.kind);
    assert.equal(shape.id, "s1");
    assert.deepEqual(shape.describe().attributes, example.attributes);
    assert.equal(shape.describe().text, example.text);
    const recreated = factory.create(example.kind, "s1", example.attributes, example.text);
    assert.deepEqual(recreated.describe(), shape.describe());
  });
}

test("omitted paints remain absent and text accepts an explicitly empty content argument", () => {
  const factory = new ShapeFactory();
  const inputs = [
    ["rect", ["1", "2", "3", "4"]], ["circle", ["1", "2", "3"]],
    ["ellipse", ["1", "2", "3", "4"]], ["line", ["1", "2", "3", "4"]],
    ["text", ["1", "2", ""]], ["g", []],
  ];
  for (const [kind, parameters] of inputs) {
    const attributes = factory.createFromParameters(kind, "s1", parameters).describe().attributes;
    assert.equal(Object.hasOwn(attributes, "fill"), false);
    assert.equal(Object.hasOwn(attributes, "stroke"), false);
    assert.equal(Object.hasOwn(attributes, "stroke-width"), false);
  }
  assert.equal(factory.createFromParameters("text", "t1", ["1", "2", ""]).describe().text, "");
});

test("factory rejects unsupported types and missing or surplus positional arguments", () => {
  const factory = new ShapeFactory();
  for (const kind of ["hexagon", "box", "Rect"]) {
    assert.throws(() => factory.create(kind, "s1"), new RegExp(`unknown shape type: ${kind}`));
    assert.throws(() => factory.createFromParameters(kind, "s1", []), /unknown shape type/);
  }
  const minimums = [["rect", 4], ["circle", 3], ["ellipse", 4], ["line", 4], ["text", 3]];
  for (const [kind, minimum] of minimums) {
    assert.throws(() => factory.createFromParameters(kind, "s1", Array(minimum - 1).fill("1")), /usage: create/);
    assert.throws(() => factory.createFromParameters(kind, "s1", Array(minimum + 2).fill("1")), /usage: create/);
  }
  assert.throws(() => factory.createFromParameters("g", "g1", ["extra"]), /usage: create g/);
});

test("factory validates decimal numbers, geometry ranges, attributes, and initial stroke width", () => {
  const factory = new ShapeFactory();
  for (const invalid of ["", " ", "NaN", "Infinity", "1e309", "12px", "0x10"]) {
    assert.throws(() => factory.createFromParameters("rect", "r1", [invalid, "2", "3", "4"]), /invalid number/);
  }
  assert.equal(factory.createFromParameters("circle", "c1", ["1e2", "+.5", "0"]).describe().attributes.cx, 100);
  assert.throws(() => factory.create("circle", "c1", { cx: true, cy: 2, r: 3 }), /invalid number/);
  assert.throws(() => factory.create("circle", "c1", { cx: 1, cy: 2, r: -1 }), /non-negative/);
  assert.throws(() => factory.create("rect", "r1", { x: 1, y: 2, width: 3 }), /missing geometry/);
  assert.throws(() => factory.create("g", "g1", { transform: "scale(2)" }), /unknown attribute: transform/);
  assert.throws(() => factory.create("g", "g1", { fill: 1 }), /invalid paint/);
  assert.throws(() => factory.create("g", "g1", { "stroke-width": -1 }), /stroke width/);
  assert.throws(() => factory.create("g", "g1", { "stroke-width": Infinity }), /invalid number/);
  assert.throws(() => factory.create("text", "t1", { x: 1, y: 2 }), /text content is required/);
  assert.throws(() => factory.create("g", "g1", {}, "text"), /only supported by text/);
  assert.deepEqual(factory.create("g", "g1", { fill: "red", stroke: "black", "stroke-width": "2" }).describe().attributes, {
    fill: "red", stroke: "black", "stroke-width": 2,
  });
});
