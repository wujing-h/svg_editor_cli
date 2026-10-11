// 用途：验证换父、同级换位及局部位置恢复，覆盖循环拒绝和历史原子性。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");

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

test("placement commands require a document and exact argument counts", async () => {
  const app = editor();
  for (const line of ["addto scene r1", "front r1", "back r1"]) {
    await assert.rejects(app.run(line), /no document/);
  }
  await app.run("init");
  for (const line of ["addto", "addto scene", "addto scene r1 extra", "front", "front r1 extra", "back", "back r1 extra"]) {
    await assert.rejects(app.run(line), /usage:/);
  }
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("addto moves a root shape to the last child and restores identity, root order, and geometry", async () => {
  const app = editor();
  await app.run("init");
  for (const line of ["create g first", "create circle c1 1 2 3 red", "create g scene", "create g last", "create circle child 4 5 6 in scene"]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const shape = doc.findShape("c1");
  const before = app.describe();
  const geometry = shape.describe();
  assert.deepEqual(await app.run("addto scene c1"), ["circle#c1 moved into g#scene"]);
  const after = app.describe();
  assert.deepEqual(doc.getRootShapes().map((node) => node.id), ["first", "scene", "last"]);
  assert.deepEqual(doc.findContainer("scene").children.map((node) => node.id), ["child", "c1"]);
  assert.equal(shape.parent, doc.findShape("scene"));
  assert.equal(shape.document, doc);
  assert.deepEqual(shape.describe(), geometry);
  assert.deepEqual(await app.run("undo"), ["circle#c1 restored to position 2 in svg"]);
  assert.deepEqual(app.describe(), before);
  assert.equal(shape.parent, undefined);
  await app.run("redo");
  assert.deepEqual(app.describe(), after);
  assert.equal(doc.findShape("c1"), shape);
});

test("addto moves an entire nested subtree, preserves empty parents, and can move upward to an ancestor", async () => {
  const app = editor();
  await app.run("init");
  for (const line of [
    "create g scene", "create g left in scene", "create g right in scene",
    "create g moving in left", "create g nested in moving", "create circle c1 1 2 3 in nested",
    "create circle existing 4 5 6 in right",
  ]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const ids = ["moving", "nested", "c1"];
  const objects = ids.map((id) => doc.findShape(id));
  const before = app.describe();
  await app.run("addto right moving");
  assert.deepEqual(doc.findContainer("left").children, []);
  assert.deepEqual(doc.findContainer("right").children.map((node) => node.id), ["existing", "moving"]);
  assert.equal(objects[1].parent, objects[0]);
  assert.equal(objects[2].parent, objects[1]);
  for (const shape of objects) {
    assert.equal(doc.findShape(shape.id), shape);
    assert.equal(shape.document, doc);
  }
  await app.run("addto scene moving");
  assert.deepEqual(doc.findContainer("scene").children.map((node) => node.id), ["left", "right", "moving"]);
  await app.run("undo");
  assert.equal(objects[0].parent, doc.findShape("right"));
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("redo");
  await app.run("redo");
  assert.equal(objects[0].parent, doc.findShape("scene"));
});

for (const command of ["front", "back"]) {
  test(`${command} changes only root sibling order and restores the original middle position`, async () => {
    const app = editor();
    await app.run("init");
    await app.run("create circle first 1 2 3");
    await app.run("create g middle");
    await app.run("create circle child 4 5 6 in middle");
    await app.run("create text last 7 8 end");
    const doc = app.session.requireDocument();
    const middle = doc.findShape("middle");
    const before = app.describe();
    const child = doc.findShape("child");
    await app.run(`${command} middle`);
    assert.deepEqual(doc.getRootShapes().map((shape) => shape.id), command === "front" ? ["first", "last", "middle"] : ["middle", "first", "last"]);
    assert.equal(middle.parent, undefined);
    assert.equal(child.parent, middle);
    await app.run("undo");
    assert.deepEqual(app.describe(), before);
    await app.run("redo");
    assert.equal(doc.findShape("middle"), middle);
  });
}

test("same-parent addto and nested front/back preserve order on repeated undo/redo", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  for (const id of ["a", "b", "c"]) {
    await app.run(`create circle ${id} 1 2 3 in scene`);
  }
  const parent = app.session.requireDocument().findContainer("scene");
  const before = app.describe();
  await app.run("addto scene a");
  assert.deepEqual(parent.children.map((node) => node.id), ["b", "c", "a"]);
  await app.run("back c");
  assert.deepEqual(parent.children.map((node) => node.id), ["c", "b", "a"]);
  await app.run("front b");
  assert.deepEqual(parent.children.map((node) => node.id), ["c", "a", "b"]);
  const after = app.describe();
  for (let iteration = 0; iteration < 3; iteration += 1) {
    for (let count = 0; count < 3; count += 1) {
      await app.run("undo");
    }
    assert.deepEqual(app.describe(), before);
    for (let count = 0; count < 3; count += 1) {
      await app.run("redo");
    }
    assert.deepEqual(app.describe(), after);
  }
});

test("already-at-boundary and only-child placement commands remain single edit units", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create circle only 1 2 3 in scene");
  const before = app.describe();
  for (const line of ["front only", "back only", "addto scene only"]) {
    await app.run(line);
    assert.deepEqual(app.describe(), before);
    await app.run("undo");
    assert.deepEqual(app.describe(), before);
  }
  // 撤销三次无位置变化的编辑后，下一次才撤销原创建。
  await app.run("undo");
  assert.deepEqual(app.session.requireDocument().findContainer("scene").children, []);
});

test("invalid targets and cycles preserve the entire document and redo history", async () => {
  const app = editor();
  await app.run("init");
  for (const line of ["create g scene", "create g outer in scene", "create g nested in outer", "create circle c1 1 2 3 in outer"]) {
    await app.run(line);
  }
  await app.run("move c1 10 20");
  await app.run("undo");
  const before = app.describe();
  for (const [line, error] of [
    ["addto missing c1", /no such container: missing/],
    ["addto c1 nested", /not a container: c1/],
    ["addto scene missing", /no such shape: missing/],
    ["addto outer outer", /cannot move a shape into itself or its descendant: outer/],
    ["addto nested outer", /cannot move a shape into itself or its descendant: outer/],
    ["addto nested scene", /cannot move a shape into itself or its descendant: scene/],
    ["front missing", /no such shape: missing/],
    ["back missing", /no such shape: missing/],
  ]) {
    await assert.rejects(app.run(line), error);
    assert.deepEqual(app.describe(), before);
  }
  await app.run("redo");
  assert.deepEqual(app.session.requireDocument().findShape("c1").describe().position, { x: 11, y: 22 });
  await app.run("undo");
  await app.run("front c1");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("canvas 400 300");
  await assert.rejects(app.run("addto nested outer"));
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
  await app.run("back c1");
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
});

test("placement restore rejects foreign records, invalid positions, leaves, and same-id replacements atomically", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g left");
  await app.run("create g right");
  await app.run("create circle c1 1 2 3 in left");
  const doc = app.session.requireDocument();
  const change = doc.addTo("right", "c1");
  const before = app.describe();
  for (const invalid of [
    { ...change.before, document: new SvgDocument(100, 100) },
    { ...change.before, index: -1 },
    { ...change.before, index: 1 },
    { ...change.before, index: 0.5 },
    { ...change.before, parent: doc.findShape("c1") },
  ]) {
    assert.throws(() => doc.restorePlacement(invalid));
    assert.deepEqual(app.describe(), before);
  }
  const originalParent = doc.remove("left");
  doc.insert(new ShapeFactory().create("g", "left"));
  const replacedParent = app.describe();
  assert.throws(() => doc.restorePlacement(change.before), /original container is not in this document: left/);
  assert.deepEqual(app.describe(), replacedParent);
  doc.remove("left");
  doc.restore(originalParent);
  const originalShape = doc.remove("c1");
  doc.insert(new ShapeFactory().create("circle", "c1", { cx: 10, cy: 20, r: 30 }), "right");
  const replacedShape = app.describe();
  assert.throws(() => doc.restorePlacement(change.before), /original shape is not in this document: c1/);
  assert.deepEqual(app.describe(), replacedShape);
  doc.remove("c1");
  doc.restore(originalShape);
  doc.restorePlacement(change.before);
  assert.equal(doc.findShape("c1").parent, originalParent.shape);
});

test("restoring a placement that would now create a cycle leaves all relationships unchanged", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g root");
  await app.run("create g parent in root");
  await app.run("create g child in parent");
  const doc = app.session.requireDocument();
  const change = doc.addTo("root", "child");
  doc.addTo("child", "parent");
  const before = app.describe();
  assert.throws(() => doc.restorePlacement(change.before), /cannot move a shape into itself or its descendant: child/);
  assert.deepEqual(app.describe(), before);
});

test("failed placement undo retains its history entry and succeeds after the original parent returns", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g left");
  await app.run("create g right");
  await app.run("create circle c1 1 2 3 in left");
  await app.run("addto right c1");
  const doc = app.session.requireDocument();
  const originalParent = doc.remove("left");
  doc.insert(new ShapeFactory().create("g", "left"));
  const before = app.describe();
  await assert.rejects(app.run("undo"), /original container is not in this document: left/);
  assert.deepEqual(app.describe(), before);
  doc.remove("left");
  doc.restore(originalParent);
  await app.run("undo");
  assert.equal(doc.findShape("c1").parent, originalParent.shape);
  const target = doc.remove("right");
  const beforeRedo = app.describe();
  await assert.rejects(app.run("redo"), /original container is not in this document: right/);
  assert.deepEqual(app.describe(), beforeRedo);
  doc.restore(target);
  await app.run("redo");
  assert.equal(doc.findShape("c1").parent, target.shape);
});

test("placement edits interleave with geometry, attributes, deletion, and creation in one history", async () => {
  const app = editor();
  await app.run("init");
  for (const line of ["create g left", "create g right", "create circle a 1 2 3 in left", "create circle b 4 5 6 in left"]) {
    await app.run(line);
  }
  const before = app.describe();
  for (const line of ["addto right a", "set a fill red", "move a 10 20", "scale right 2", "back right", "delete left", "create text new 0 0 label in right"]) {
    await app.run(line);
  }
  const after = app.describe();
  for (let count = 0; count < 7; count += 1) {
    await app.run("undo");
  }
  assert.deepEqual(app.describe(), before);
  for (let count = 0; count < 7; count += 1) {
    await app.run("redo");
  }
  assert.deepEqual(app.describe(), after);
});
