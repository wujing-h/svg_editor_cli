// 用途：用纯内容和事件替身独立验证保存基线、祖先传播、规范化及订阅生命周期。
const assert = require("node:assert/strict");
const test = require("node:test");
const { ModifiedStar, ModifiedStarPlugin } = require("../dist/index.js");
const metadata = require("../package.json");
const leaf = (id, x = 1) => ({ id, kind: "rect", attributes: { x, y: 2, width: 3, height: 4 } });
const snapshot = (children = [leaf("r")], width = 400) => ({ canvas: { width, height: 300 }, roots: [{ id: "g", kind: "g", attributes: {}, children }] });
const node = (label, id) => label.getSuffix({ shape: { id }, canvas: undefined });
const root = (label) => label.getSuffix({ shape: undefined, canvas: { width: 400, height: 300 } });

test("initialize is clean, new nodes are dirty, save becomes the baseline and undo returns clean", () => {
  const label = new ModifiedStar();
  const empty = snapshot([]);
  label.observe({ kind: "initialize", snapshot: empty });
  assert.equal(root(label), undefined);
  const created = snapshot();
  label.observe({ kind: "edit", snapshot: created });
  assert.equal(root(label), "*");
  assert.equal(node(label, "r"), "*");
  label.observe({ kind: "save", snapshot: created });
  assert.equal(root(label), undefined);
  label.observe({ kind: "edit", snapshot: snapshot([leaf("r", 10)]) });
  assert.equal(node(label, "r"), "*");
  assert.equal(node(label, "g"), "*");
  label.observe({ kind: "undo", snapshot: created });
  assert.equal(node(label, "r"), undefined);
  assert.equal(root(label), undefined);
  label.observe({ kind: "redo", snapshot: snapshot([leaf("r", 10)]) });
  assert.equal(root(label), "*");
});

test("read resets the baseline and canvas edits mark only the SVG root", () => {
  const label = new ModifiedStar(snapshot());
  label.observe({ kind: "canvas", snapshot: snapshot([leaf("r")], 500) });
  assert.equal(root(label), "*");
  assert.equal(node(label, "r"), undefined);
  assert.equal(node(label, "g"), undefined);
  label.observe({ kind: "read", snapshot: snapshot([leaf("loaded")], 600) });
  assert.equal(root(label), undefined);
  assert.equal(node(label, "loaded"), undefined);
});

test("attributes compare by key/value content rather than object insertion order or derived fields", () => {
  const before = snapshot();
  const after = snapshot([{ ...leaf("r"), attributes: { height: 4, width: 3, y: 2, x: 1 }, geometry: { x: 999 } }]);
  const label = new ModifiedStar(before);
  label.observe({ kind: "edit", snapshot: after });
  assert.equal(root(label), undefined);
  assert.equal(node(label, "r"), undefined);
  after.roots[0].children[0].attributes.fill = "none";
  label.observe({ kind: "edit", snapshot: after });
  assert.equal(node(label, "r"), "*");
});

test("deletion, reordering and reparenting compare structural content and node placement", () => {
  const before = snapshot([leaf("a"), leaf("b")]);
  const label = new ModifiedStar(before);
  label.observe({ kind: "edit", snapshot: snapshot([leaf("b"), leaf("a")]) });
  assert.equal(node(label, "g"), "*");
  assert.equal(node(label, "a"), "*");
  label.observe({ kind: "undo", snapshot: before });
  assert.equal(root(label), undefined);
  label.observe({ kind: "edit", snapshot: snapshot([leaf("a")]) });
  assert.equal(node(label, "g"), "*");
  assert.equal(node(label, "a"), undefined);
  const reparented = { ...before, roots: [before.roots[0], { id: "other", kind: "g", attributes: {}, children: [] }] };
  const saved = structuredClone(reparented);
  label.observe({ kind: "save", snapshot: saved });
  reparented.roots[0] = { ...reparented.roots[0], children: [leaf("b")] };
  reparented.roots[1] = { ...reparented.roots[1], children: [leaf("a")] };
  label.observe({ kind: "edit", snapshot: reparented });
  assert.equal(node(label, "a"), "*");
  assert.equal(node(label, "other"), "*");
});

test("empty strings, missing attributes, type and text differences are preserved", () => {
  const before = snapshot([{ id: "t", kind: "text", attributes: {}, text: "" }]);
  const label = new ModifiedStar(before);
  for (const changed of [{ id: "t", kind: "text", attributes: { fill: "" }, text: "" },
    { id: "t", kind: "text", attributes: {}, text: "new" }, { id: "t", kind: "text", type: "custom", attributes: {}, text: "" }]) {
    label.observe({ kind: "edit", snapshot: snapshot([changed]) });
    assert.equal(node(label, "t"), "*");
  }
});

test("save events retain the saved content while allowing a newer current document", () => {
  const saved = snapshot();
  const current = snapshot([leaf("r", 20)]);
  const label = new ModifiedStar(saved);
  label.observe({ kind: "save", snapshot: saved }, current);
  assert.equal(node(label, "r"), "*");
  label.observe({ kind: "undo", snapshot: saved });
  assert.equal(root(label), undefined);
});

test("instances do not share baselines and activation registers a disposable observer", () => {
  const instances = [];
  const resources = [];
  const callbacks = [];
  const plugin = new ModifiedStarPlugin();
  for (const initial of [snapshot(), snapshot([leaf("other")])]) {
    plugin.activate({ services: { editor: { getSnapshot: () => initial, onDidChange(callback) {
      callbacks.push(callback); return { dispose() { resources.push("disposed"); } };
    } } }, registerDecorator: (label) => instances.push(label), addDisposable: (resource) => resources.push(resource) });
  }
  assert.notEqual(instances[0], instances[1]);
  assert.equal(root(instances[0]), undefined);
  assert.equal(root(instances[1]), undefined);
  assert.deepEqual(metadata.contributes.decorators, [instances[0].name]);
  resources[0].dispose();
  assert.ok(resources.includes("disposed"));
  assert.throws(() => plugin.activate({}, {}), /does not accept options/);
});
