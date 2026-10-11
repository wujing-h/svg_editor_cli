// 用途：验证创建、移动及历史的可观察行为，覆盖失败原子性与 IO 历史限制。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { CircleShape } = require("../dist/domain/CircleShape.js");

function editor() {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  return {
    session,
    run: async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line))),
    describe: () => session.requireDocument().getRootShapes().map((shape) => shape.describe()),
  };
}

test("editing and history require a document while help remains available", async () => {
  const app = editor();
  for (const line of ["create g scene", "move r1 1 2", "undo", "redo"]) {
    await assert.rejects(app.run(line), /no document\. use 'init' or 'read' first/);
  }
  assert.ok((await app.run("help")).some((line) => line.startsWith("create ")));
});

test("create supports all six types, nested in clauses, quoted text, and missing styles", async () => {
  const app = editor();
  await app.run("init");
  assert.deepEqual(await app.run("create g scene"), ["g#scene created"]);
  assert.deepEqual(await app.run("create g nested in scene"), ["g#nested created in g#scene"]);
  for (const line of [
    "create rect r1 0 1 2 3 #ff0000 in nested",
    "create circle c1 10 20 5 in nested",
    "create ellipse e1 30 40 6 7 in nested",
    "create line l1 -1 -2 3 4 black in nested",
    'create text t1 5 6 "  in <&>  " in nested',
    'create text t2 0 0 "in"',
    "create circle C1 0 0 0",
  ]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  assert.deepEqual(doc.findContainer("nested").children.map((shape) => shape.id), ["r1", "c1", "e1", "l1", "t1"]);
  assert.equal(doc.findShape("r1").describe().attributes.fill, "#ff0000");
  assert.equal(Object.hasOwn(doc.findShape("c1").describe().attributes, "fill"), false);
  assert.equal(doc.findShape("l1").describe().attributes.stroke, "black");
  assert.equal(doc.findShape("t1").describe().text, "  in <&>  ");
  assert.equal(doc.findShape("t2").describe().text, "in");
  assert.notEqual(doc.findShape("c1"), doc.findShape("C1"));
});

test("failed creates preserve document structure and an existing redo entry", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create rect r1 0 0 10 20 in scene");
  await app.run("create circle c1 1 2 3 in scene");
  const circle = app.session.requireDocument().findShape("c1");
  await app.run("undo");
  const before = app.describe();
  const failures = [
    ["create g scene", /id already exists: scene/],
    ["create g new in missing", /no such container: missing/],
    ["create g new in r1", /not a container: r1/],
    ["create box new", /unknown shape type: box \(is the plugin loaded\?\)/],
    ["create rect new 0 0 -1 2", /non-negative/],
    ["create circle new NaN 0 1", /invalid number/],
    ["create rect new 0 0 1 2 in", /usage/],
    ['create g new "in" scene', /usage/],
    ["create g", /usage/],
    ['create g ""', /id must not be empty/],
  ];
  for (const [line, error] of failures) {
    await assert.rejects(app.run(line), error);
    assert.deepEqual(app.describe(), before);
  }
  await app.run("redo");
  assert.equal(app.session.requireDocument().findShape("c1"), circle);
  assert.deepEqual(circle.parent.children.map((shape) => shape.id), ["r1", "c1"]);
});

test("create undo and redo reuse original objects, parents, and sibling order", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create rect r1 0 0 10 20 in scene");
  await app.run("create circle c1 1 2 3 in scene");
  const doc = app.session.requireDocument();
  const shapes = [doc.findShape("scene"), doc.findShape("r1"), doc.findShape("c1")];
  const before = app.describe();
  for (let index = 0; index < 3; index += 1) {
    await app.run("undo");
  }
  assert.deepEqual(doc.getRootShapes(), []);
  for (const shape of shapes) {
    assert.equal(shape.document, undefined);
    await app.run("redo");
    assert.equal(doc.findShape(shape.id), shape);
  }
  assert.deepEqual(app.describe(), before);
  assert.equal(shapes[1].parent, shapes[0]);
  assert.equal(shapes[2].parent, shapes[0]);
  await assert.rejects(app.run("redo"), /nothing to redo/);
});

test("create restoration failures keep the original target and history available for retry", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create circle c1 1 2 3");
  const doc = app.session.requireDocument();
  const original = doc.findShape("c1");
  // 模拟恢复前的 id 冲突；失败必须保留当前树与栈顶命令。
  const originalLocation = doc.remove("c1");
  const replacement = new CircleShape("c1", 10, 20, 30);
  doc.insert(replacement);
  const before = app.describe();
  await assert.rejects(app.run("undo"), /create target is no longer in this document/);
  assert.deepEqual(app.describe(), before);
  assert.equal(doc.findShape("c1"), replacement);
  doc.remove("c1");
  doc.restore(originalLocation);
  await app.run("undo");
  doc.insert(replacement);
  await assert.rejects(app.run("redo"), /id already exists: c1/);
  assert.equal(doc.findShape("c1"), replacement);
  assert.equal(original.document, undefined);
  doc.remove("c1");
  await app.run("redo");
  assert.equal(doc.findShape("c1"), original);
});

test("move summaries follow the example and snapshots avoid floating point drift", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create circle c1 100 100 20 red");
  assert.deepEqual(await app.run("move c1 30 0"), ["circle#c1 moved to (130,100)"]);
  assert.deepEqual(await app.run("undo"), ["circle#c1 moved back to (100,100)"]);
  assert.deepEqual(await app.run("redo"), ["circle#c1 moved to (130,100)"]);
  await app.run("create rect r1 .1 .2 3 4");
  const rect = app.session.requireDocument().findShape("r1");
  const before = rect.describe();
  await app.run("move r1 .2 .1");
  const after = rect.describe();
  for (let index = 0; index < 10; index += 1) {
    await app.run("undo");
    assert.deepEqual(rect.describe(), before);
    await app.run("redo");
    assert.deepEqual(rect.describe(), after);
  }
  assert.equal(after.attributes.width, 3);
  assert.equal(after.attributes.height, 4);
});

test("moving a mixed nested group is one undo unit and keeps hierarchy and styles", async () => {
  const app = editor();
  await app.run("init");
  for (const line of [
    "create g scene", "create g nested in scene",
    "create rect r1 0 1 2 3 red in scene",
    "create circle c1 10 20 5 in nested",
    "create ellipse e1 30 40 6 7 in nested",
    "create line l1 -1 -2 3 4 black in nested",
    'create text t1 5 6 "内容" in nested',
  ]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const before = app.describe();
  assert.deepEqual(await app.run("move scene 5 -2"), ["g#scene moved by (5,-2)"]);
  const after = app.describe();
  assert.deepEqual(doc.findShape("r1").describe().attributes, { x: 5, y: -1, width: 2, height: 3, fill: "red" });
  assert.deepEqual(doc.findShape("c1").describe().position, { x: 15, y: 18 });
  assert.deepEqual(doc.findShape("l1").describe().attributes, { x1: 4, y1: -4, x2: 8, y2: 2, stroke: "black" });
  assert.deepEqual(doc.findShape("t1").describe().position, { x: 10, y: 4 });
  assert.equal(doc.findShape("e1").parent, doc.findShape("nested"));
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("redo");
  assert.deepEqual(app.describe(), after);
});

test("failed moves preserve the whole group and redo; a successful new edit clears redo", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create rect r1 0 0 1 2 in scene");
  await app.run("create circle large 1e308 0 1 in scene");
  await app.run("move r1 10 20");
  await app.run("undo");
  const before = app.describe();
  for (const line of ["move scene 1e308 0", "move r1 NaN 0", "move r1 1", "move missing 1 2", "move r1 1 2 extra"]) {
    await assert.rejects(app.run(line));
    assert.deepEqual(app.describe(), before);
  }
  await app.run("redo");
  assert.deepEqual(app.session.requireDocument().findShape("r1").describe().position, { x: 10, y: 20 });
  await app.run("undo");
  await app.run("create text new 0 0 branch");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
});

test("IO restrictions survive queries and failures until a successful edit", async () => {
  const app = editor();
  await app.run("init");
  for (const line of ["help", "canvas"]) {
    await app.run(line);
  }
  await assert.rejects(app.run("create circle bad 0 0 -1"));
  await assert.rejects(app.run("init 0 100"));
  await assert.rejects(app.run("canvas 0 100"));
  for (const line of ["undo", "redo"]) {
    await assert.rejects(app.run(line), /undo not allowed after io command/);
  }
  await app.run("create g scene");
  await app.run("undo");
  await assert.rejects(app.run("undo"), /nothing to undo/);
  await app.run("help");
  await app.run("canvas");
  await assert.rejects(app.run("undo extra"), /usage: undo/);
  await assert.rejects(app.run("redo extra"), /usage: redo/);
  await app.run("redo");
  assert.equal(app.session.requireDocument().findShape("scene").kind, "g");
});

test("failed document commands preserve history; successful resize and init clear both stacks", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create rect r1 0 0 1 2");
  await app.run("move r1 10 20");
  await app.run("undo");
  const original = app.session.requireDocument();
  await assert.rejects(app.run("init 100 -1"));
  await assert.rejects(app.run("canvas 100 -1"));
  assert.equal(app.session.requireDocument(), original);
  await app.run("canvas");
  await app.run("redo");
  assert.deepEqual(original.findShape("r1").describe().position, { x: 10, y: 20 });
  await app.run("undo");
  await app.run("canvas 400 300");
  for (const line of ["undo", "redo"]) {
    await assert.rejects(app.run(line), /undo not allowed after io command/);
  }
  await app.run("move r1 1 2");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  await assert.rejects(app.run("undo"), /nothing to undo/);
  await app.run("init 200 100");
  assert.notEqual(app.session.requireDocument(), original);
  await assert.rejects(app.run("redo"), /undo not allowed after io command/);
  await app.run("create g fresh");
  await app.run("undo");
  await assert.rejects(app.run("undo"), /nothing to undo/);
  assert.deepEqual(app.describe(), []);
});
