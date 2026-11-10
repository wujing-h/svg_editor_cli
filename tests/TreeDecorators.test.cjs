// 用途：验证树行包装链、稳定排序、只读标签上下文及违规标签隔离。
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { BaseTreeLineRenderer } = require("../dist/cli/BaseTreeLineRenderer.js");
const { DecoratedTreeLineRenderer } = require("../dist/cli/DecoratedTreeLineRenderer.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const createDispatcher = require("./helpers/createDispatcher.cjs");

const tree = () => ({ tree: { canvas: { width: 400, height: 300 }, roots: [
  { id: "scene", kind: "g", attributes: {}, children: [
    { id: "r", kind: "rect", geometry: { x: 1, y: 2, width: 3, height: 4 }, attributes: { x: 1, y: 2, width: 3, height: 4, fill: "red" } },
    { id: "title", kind: "text", position: { x: 5, y: 6 }, geometry: { x: 5, y: 6 }, attributes: { x: 5, y: 6 }, text: "hello" },
  ] },
] } });
const tag = (name, order, getSuffix = () => name) => ({ name, order, getSuffix });

test("base and decorated renderers implement the same interface and compose by wrapping", () => {
  const context = { shape: undefined, canvas: { width: 400, height: 300 } };
  const base = new BaseTreeLineRenderer();
  const inner = new DecoratedTreeLineRenderer(base, tag("first", 1), assert.fail);
  const outer = new DecoratedTreeLineRenderer(inner, tag("second", 2), assert.fail);
  assert.equal(base.render(context), "svg (400x300)");
  assert.equal(outer.render(context), "svg (400x300) first second");
});

test("an empty decorator chain retains the exact original tree, columns and connectors", () => {
  assert.deepEqual(new CliFormatter(() => []).format(tree()), [
    "svg (400x300)", "└── g#scene", "    ├── rect#r      x=1 y=2 w=3 h=4 fill=red", '    └── text#title  (5,6) "hello"',
  ]);
});

test("labels are appended in order then name order, including SVG root and selected subtree rows", () => {
  const decorators = [tag("last", 20), tag("z", 10), tag("a", 10), tag("silent", 0, () => undefined)];
  const formatter = new CliFormatter(() => decorators);
  const base = new CliFormatter().format(tree());
  assert.deepEqual(formatter.format(tree()), base.map((line) => `${line} a z last`));
  const selected = { tree: { roots: [tree().tree.roots[0]] } };
  assert.deepEqual(formatter.format(selected), new CliFormatter().format(selected).map((line) => `${line} a z last`));
  assert.deepEqual(decorators.map((decorator) => decorator.name), ["last", "z", "a", "silent"]);
});

test("root and shape contexts are distinct, frozen and independent of the caller's data", () => {
  const result = tree();
  const seen = [];
  const formatter = new CliFormatter(() => [tag("inspect", 0, (context) => {
    assert.ok(Object.isFrozen(context));
    if (context.shape === undefined) {
      assert.ok(Object.isFrozen(context.canvas));
      assert.equal(context.canvas.width, 400);
      seen.push("svg");
    } else {
      assert.equal(context.canvas, undefined);
      assert.ok(Object.isFrozen(context.shape.attributes));
      assert.notEqual(context.shape, result.tree.roots[0]);
      seen.push(context.shape.id);
    }
    return undefined;
  })]);
  formatter.format(result);
  assert.deepEqual(seen, ["svg", "scene", "r", "title"]);
  assert.equal(Object.isFrozen(result.tree.roots[0]), false);
  result.tree.roots[0].id = "caller-still-owns-this";
});

test("empty suffixes add no spaces and ordinary suffixes are trimmed to a single separator", () => {
  for (const suffix of [undefined, "", "   "]) {
    assert.deepEqual(new CliFormatter(() => [tag("empty", 0, () => suffix)]).format(tree()), new CliFormatter().format(tree()));
  }
  const lines = new CliFormatter(() => [tag("trimmed", 0, () => "  [tag]  ")]).format(tree());
  assert.deepEqual(lines, new CliFormatter().format(tree()).map((line) => `${line} [tag]`));
});

test("throwing, invalid and asynchronous labels are reported once and quarantined across later renders", async () => {
  for (const getSuffix of [() => { throw new Error("label exploded"); }, () => "two\nlines", () => "tab\tlabel",
    () => "line\u2028separator", () => 42, () => null, async () => { throw new Error("async label"); }]) {
    const errors = [];
    let calls = 0;
    const broken = tag("broken", 10, (context) => { calls += 1; return getSuffix(context); });
    const formatter = new CliFormatter(() => [tag("good", 0), broken, tag("tail", 20)], (error) => errors.push(error));
    const expected = new CliFormatter().format(tree()).map((line) => `${line} good tail`);
    assert.deepEqual(formatter.format(tree()), expected);
    assert.deepEqual(formatter.format(tree()), expected);
    assert.equal(calls, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /tree decorator failed: broken/);
  }
  await Promise.resolve();
});

test("a tag cannot mutate another tag's input, and a failing error reporter cannot break rendering", () => {
  const formatter = new CliFormatter(() => [
    tag("mutator", 0, (context) => { context.canvas.width = 999; }),
    tag("reader", 1, (context) => context.canvas === undefined ? undefined : String(context.canvas.width)),
  ], () => { throw new Error("reporter failed"); });
  const expected = new CliFormatter().format(tree());
  expected[0] += " 400";
  assert.deepEqual(formatter.format(tree()), expected);
});

test("late registry activation reaches formatting without changing show, document content or history", async () => {
  const session = new EditorSession();
  const host = new PluginHost({ editor: session, directory: {} });
  const formatter = new CliFormatter(() => host.decorators.getAll());
  const dispatcher = createDispatcher(session);
  const parser = new CommandLineParser();
  const run = async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line)));
  await run("init");
  await run("create rect r 1 2 3 4");
  await run("move r 10 20");
  await run("undo");
  const before = session.getSnapshot();
  const show = await run("show r");
  host.activate({ name: "test-labels", contributes: { decorators: ["registered"] } }, {
    activate: (context) => context.registerDecorator(tag("registered", 1)),
  });
  assert.ok((await run("tree")).every((line) => line.endsWith(" registered")));
  assert.deepEqual(await run("show r"), show);
  assert.deepEqual(session.getSnapshot(), before);
  await run("redo");
  assert.equal(session.requireDocument().findShape("r").describe().geometry.x, 11);
});
