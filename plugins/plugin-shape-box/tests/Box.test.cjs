// 用途：仅通过公开 API 与替身独立验证 box 模板、结构规则、读取及属性映射。
const assert = require("node:assert/strict");
const test = require("node:test");
const { RectShape, TextShape, GroupShape } = require("pj/plugin-api");
const { BoxProvider, BoxShape, BoxAttributes, BoxTypeLabel, BoxPlugin } = require("../dist/index.js");
const provider = new BoxProvider();
const metadata = require("../package.json");

test("one create returns a complete native g template with the specified IDs, offsets and fill", () => {
  const box = provider.createFromParameters("n1", ["120", "100", "160", "60", "开始"]);
  assert.equal(box.kind, "g");
  assert.equal(box.type, "box");
  assert.deepEqual(box.children.map((part) => part.id), ["n1-rect", "n1-label"]);
  assert.deepEqual(box.children[0].describe().geometry, { x: 120, y: 100, width: 160, height: 60 });
  assert.equal(box.children[0].describe().attributes.fill, "#4a90d9");
  assert.deepEqual(box.children[1].describe().position, { x: 140, y: 135 });
  assert.equal(box.children[1].describe().text, "开始");
  assert.equal(box.describe().attributes["data-kind"], "box");
  assert.ok(box.children.every((part) => part.parent === box && part.document === undefined));
});

test("inherited Composite geometry changes and restores the exact whole subtree", () => {
  const box = provider.create("b", { x: 1, y: 2, width: 3, height: 4 }, "");
  const before = box.describe();
  const state = box.captureGeometry();
  box.move(10, 20);
  box.scale(2);
  assert.equal(box.children[0].describe().geometry.x, 22);
  assert.equal(box.children[1].describe().geometry.y, 114);
  box.restoreGeometry(state);
  assert.deepEqual(box.describe(), before);
});

test("invalid create parameters and numeric forms fail instead of producing partial templates", () => {
  for (const parameters of [[], ["1", "2", "3", "4"], ["1", "2", "3", "4", "x", "extra"],
    ["0x10", "2", "3", "4", "x"], ["1", "2", "-1", "4", "x"], ["Infinity", "2", "3", "4", "x"]]) {
    assert.throws(() => provider.createFromParameters("bad", parameters));
  }
  assert.throws(() => provider.create("b", { x: 1, y: 2, width: 3, height: 4, extra: 1 }, "x"), /unknown attribute/);
  assert.throws(() => provider.create("b", { x: 1, y: 2, width: 3, height: 4 }), /label is required/);
});

test("candidate lists must retain original necessary objects but allow extras and ordering changes", () => {
  const box = provider.createFromParameters("b", ["1", "2", "3", "4", "x"]);
  const parts = box.children;
  box.validateChildren([...parts].reverse());
  box.validateChildren([...parts, new GroupShape("extra")]);
  assert.throws(() => box.validateChildren(parts.slice(1)), /required component must remain: b-rect/);
  assert.throws(() => box.validateChildren([new RectShape("b-rect", 1, 2, 3, 4), parts[1]]), /required component/);
  assert.throws(() => box.assertCanUngroup(), /cannot ungroup composite shape: b/);
});

test("bad SVG components are rejected before claiming children", () => {
  const rect = new RectShape("b-rect", 0, 0, 1, 1);
  assert.throws(() => new BoxShape("b", [rect]), /invalid box components/);
  assert.equal(rect.parent, undefined);
  assert.throws(() => new BoxShape("b", [rect, new RectShape("b-label", 0, 0, 1, 1)]), /invalid box components/);
  assert.equal(rect.parent, undefined);
});

test("SVG rebuilding preserves all original children, geometry, text presentation and parent styles", () => {
  const children = [new TextShape("b-label", 7, 8, "loaded", { fontSize: "18px", textAnchor: "middle" }),
    new RectShape("b-rect", 9, 10, 11, 12, { fill: "orange" }), new GroupShape("extra")];
  const box = provider.createFromSvg({ id: "b", tagName: "g", attributes: { "data-kind": "box", stroke: "green", "stroke-width": "2px", "font-size": "16" }, text: "\n ", children });
  assert.deepEqual(box.children, children);
  assert.equal(box.children[0].describe().text, "loaded");
  assert.equal(box.children[1].describe().geometry.x, 9);
  assert.deepEqual(box.describe().attributes, { stroke: "green", "stroke-width": 2, "font-size": "16", "data-kind": "box" });
  assert.throws(() => provider.createFromSvg({ id: "b", tagName: "rect", attributes: { "data-kind": "box" }, text: "", children: [] }), /requires/);
  assert.throws(() => provider.createFromSvg({ id: "b", tagName: "g", attributes: { "data-kind": "box", transform: "scale(2)" }, text: "", children: [] }), /unknown attribute/);
});

test("attribute strategy maps only fill and label, and only writes through its context", () => {
  const attributes = new BoxAttributes();
  const box = provider.createFromParameters("b", ["1", "2", "3", "4", "title"]).describe();
  const writes = [];
  const context = { getShape: (id) => box.children.find((part) => part.id === id), setAttribute: (...args) => writes.push(args) };
  attributes.apply(context, box, "fill", "red");
  attributes.apply(context, box, "label", "new title");
  assert.deepEqual(writes, [["b-rect", "fill", "red"], ["b-label", "text", "new title"]]);
  assert.equal(attributes.handles({ ...box, type: undefined }, "fill"), false);
  assert.equal(attributes.handles(box, "stroke"), false);
});

test("type label uses semantic type rather than a preserved unknown SVG marker", () => {
  const label = new BoxTypeLabel();
  assert.equal(label.getSuffix({ shape: { type: "box" } }), "(box)");
  assert.equal(label.getSuffix({ shape: { kind: "g", attributes: { "data-kind": "box" } } }), undefined);
  assert.equal(label.getSuffix({ canvas: { width: 1, height: 1 } }), undefined);
});

test("package contributions match registrations and invalid options register nothing", () => {
  const registrations = { shapes: [], attributes: [], decorators: [] };
  const context = { registerShape: (item) => registrations.shapes.push(item.name),
    registerAttributeHandler: (item) => registrations.attributes.push(item.name), registerDecorator: (item) => registrations.decorators.push(item.name) };
  new BoxPlugin().activate(context);
  assert.deepEqual(registrations, metadata.contributes);
  assert.throws(() => new BoxPlugin().activate({}, {}), /does not accept options/);
});
