// 用途：验证分组与解组的顺序、局部恢复、失败原子性和混合编辑历史。
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

async function runAll(app, lines) {
  for (const line of lines) {
    await app.run(line);
  }
}

test("grouping commands require a document and valid argument counts", async () => {
  const app = editor();
  await assert.rejects(app.run("group pack a"), /no document/);
  await assert.rejects(app.run("ungroup pack"), /no document/);
  await app.run("init");
  for (const line of ["group", "group pack", "ungroup", "ungroup pack extra"]) {
    await assert.rejects(app.run(line), /usage:/);
  }
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("group preserves original order for all six types and restores gaps and object identity", async () => {
  const app = editor();
  await runAll(app, [
    "init", "create g scene", "create text first 0 0 first in scene",
    "create rect r 1 2 3 4 red in scene", "create circle c 5 6 7 in scene",
    "create text gap 0 0 gap in scene", "create ellipse e 8 9 10 11 in scene",
    "create line l 12 13 14 15 black in scene", 'create text t 16 17 "a b" in scene',
    "create g inner in scene", "create circle nested 1 2 3 in inner",
    "create text last 0 0 last in scene",
  ]);
  const doc = app.session.requireDocument();
  const ids = ["r", "c", "e", "l", "t", "inner", "nested"];
  const objects = ids.map((id) => doc.findShape(id));
  const descriptions = objects.map((shape) => shape.describe());
  const before = app.describe();
  assert.deepEqual(await app.run("group pack inner t l e c r"), ["g#pack created with 6 children"]);
  const group = doc.findContainer("pack");
  const after = app.describe();
  assert.equal(group.parent, doc.findShape("scene"));
  assert.deepEqual(group.children.map((shape) => shape.id), ["r", "c", "e", "l", "t", "inner"]);
  assert.deepEqual(doc.findContainer("scene").children.map((shape) => shape.id), ["first", "gap", "last", "pack"]);
  assert.deepEqual(objects.map((shape) => shape.describe()), descriptions);
  assert.equal(doc.findShape("nested").parent, doc.findShape("inner"));
  for (let iteration = 0; iteration < 3; iteration += 1) {
    await app.run("undo");
    assert.deepEqual(app.describe(), before);
    assert.throws(() => doc.findShape("pack"), /no such shape/);
    assert.equal(group.document, undefined);
    assert.equal(group.parent, undefined);
    assert.deepEqual(group.children, []);
    await app.run("redo");
    assert.deepEqual(app.describe(), after);
    assert.equal(doc.findShape("pack"), group);
    for (const shape of objects) {
      assert.equal(doc.findShape(shape.id), shape);
      assert.equal(shape.document, doc);
    }
  }
});

test("cross-container grouping uses the nearest shared ancestor and preserves empty containers", async () => {
  const app = editor();
  await runAll(app, [
    "init", "create g scene", "create g outer in scene", "create g left in outer",
    "create g right in outer", "create circle a 1 2 3 in left", "create circle b 4 5 6 in right",
    "create circle tail 7 8 9 in outer",
  ]);
  const doc = app.session.requireDocument();
  const before = app.describe();
  await app.run("group pack b a");
  assert.equal(doc.findShape("pack").parent, doc.findShape("outer"));
  assert.deepEqual(doc.findContainer("pack").children.map((shape) => shape.id), ["a", "b"]);
  assert.deepEqual(doc.findContainer("outer").children.map((shape) => shape.id), ["left", "right", "tail", "pack"]);
  assert.deepEqual(doc.findContainer("left").children, []);
  assert.deepEqual(doc.findContainer("right").children, []);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
});

test("grouping across root branches moves whole subtrees and appends the new root group", async () => {
  const app = editor();
  await runAll(app, [
    "init", "create g left", "create g subtree in left", "create circle child 1 2 3 in subtree",
    "create g right", "create circle outside 4 5 6 in right",
  ]);
  const doc = app.session.requireDocument();
  const before = app.describe();
  await app.run("group pack outside subtree");
  assert.deepEqual(doc.getRootShapes().map((shape) => shape.id), ["left", "right", "pack"]);
  assert.equal(doc.findShape("pack").parent, undefined);
  assert.deepEqual(doc.findContainer("pack").children.map((shape) => shape.id), ["subtree", "outside"]);
  assert.equal(doc.findShape("child").parent, doc.findShape("subtree"));
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("redo");
  await assert.rejects(app.run("ungroup pack"), /cannot ungroup top-level container: pack/);
});

test("invalid grouping is atomic and retains redo and the IO restriction", async () => {
  const app = editor();
  await runAll(app, ["init", "create g scene", "create g branch in scene", "create circle c 1 2 3 in branch", "move c 10 20", "undo"]);
  const before = app.describe();
  for (const [line, error] of [
    ["group scene c", /id already exists: scene/],
    ["group pack c missing", /no such shape: missing/],
    ["group pack c c", /duplicate group member: c/],
    ["group pack branch c", /cannot group a container into its own descendant: branch/],
    ["group pack c branch", /cannot group a container into its own descendant: branch/],
    ["group pack scene c", /cannot group a container into its own descendant: scene/],
    ['group "" c', /shape id must not be empty/],
  ]) {
    await assert.rejects(app.run(line), error);
    assert.deepEqual(app.describe(), before);
  }
  await app.run("redo");
  assert.deepEqual(app.session.requireDocument().findShape("c").describe().position, { x: 11, y: 22 });
  await runAll(app, ["undo", "canvas 400 300"]);
  await assert.rejects(app.run("group pack branch c"));
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
  await app.run("group pack c");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
});

test("a single member can be grouped and group IDs remain case-sensitive", async () => {
  const app = editor();
  await runAll(app, ["init", "create g pack", "create circle c 1 2 3", "group Pack c"]);
  const doc = app.session.requireDocument();
  assert.deepEqual(doc.findContainer("Pack").children.map((shape) => shape.id), ["c"]);
  assert.deepEqual(doc.findContainer("pack").children, []);
  await app.run("undo");
  assert.equal(doc.findShape("c").parent, undefined);
});

test("ungroup replaces a nested container in place and restores the same styled group and children", async () => {
  const app = editor();
  await runAll(app, [
    "init", "create g scene", "create circle first 1 2 3 in scene", "create g pack in scene",
    "create circle a 4 5 6 red in pack", "create g inner in pack", "create text label 7 8 content in inner",
    "create circle last 9 10 11 in scene", "set pack fill blue", "set pack stroke-width 2",
  ]);
  const doc = app.session.requireDocument();
  const before = app.describe();
  const group = doc.findContainer("pack");
  const a = doc.findShape("a");
  const inner = doc.findShape("inner");
  assert.deepEqual(await app.run("ungroup pack"), ["g#pack ungrouped"]);
  const after = app.describe();
  assert.deepEqual(doc.findContainer("scene").children.map((shape) => shape.id), ["first", "a", "inner", "last"]);
  assert.equal(a.parent, doc.findShape("scene"));
  assert.equal(inner.parent, doc.findShape("scene"));
  assert.equal(doc.findShape("label").parent, inner);
  assert.equal(group.document, undefined);
  assert.deepEqual(group.children, []);
  assert.equal(a.describe().attributes.fill, "red");
  assert.throws(() => doc.findShape("pack"), /no such shape: pack/);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    assert.deepEqual(await app.run("undo"), ["g#pack restored"]);
    assert.deepEqual(app.describe(), before);
    assert.equal(doc.findShape("pack"), group);
    assert.equal(doc.findShape("a"), a);
    assert.equal(doc.findShape("inner"), inner);
    await app.run("redo");
    assert.deepEqual(app.describe(), after);
  }
});

test("ungrouping an empty nested container is reversible", async () => {
  const app = editor();
  await runAll(app, ["init", "create g scene", "create g first in scene", "create g empty in scene", "create g last in scene"]);
  const doc = app.session.requireDocument();
  const before = app.describe();
  const empty = doc.findShape("empty");
  await app.run("ungroup empty");
  assert.deepEqual(doc.findContainer("scene").children.map((shape) => shape.id), ["first", "last"]);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  assert.equal(doc.findShape("empty"), empty);
  await app.run("redo");
  assert.throws(() => doc.findShape("empty"));
});

test("invalid ungroup leaves the document and redo intact", async () => {
  const app = editor();
  await runAll(app, ["init", "create g scene", "create g pack in scene", "create circle c 1 2 3 in pack", "ungroup pack", "undo"]);
  const before = app.describe();
  for (const [line, error] of [
    ["ungroup scene", /cannot ungroup top-level container: scene/],
    ["ungroup c", /not a container: c/],
    ["ungroup missing", /no such container: missing/],
  ]) {
    await assert.rejects(app.run(line), error);
    assert.deepEqual(app.describe(), before);
  }
  await app.run("redo");
  assert.equal(app.session.requireDocument().findShape("c").parent.id, "scene");
});

test("grouping history interleaves with all other edits and safely reuses a dissolved group ID", async () => {
  const app = editor();
  await runAll(app, ["init", "create g scene", "create g other in scene", "create circle a 1 2 3 in scene", "create circle b 4 5 6 in scene"]);
  const doc = app.session.requireDocument();
  const before = app.describe();
  const edits = [
    "group pack b a", "move pack 10 20", "scale pack 2", "set pack fill blue", "ungroup pack",
    "addto other a", "front b", "delete b", "create g pack in scene", "create circle new 7 8 9 in pack",
  ];
  await runAll(app, edits);
  const after = app.describe();
  const replacement = doc.findShape("pack");
  for (let iteration = 0; iteration < 2; iteration += 1) {
    for (const _ of edits) {
      await app.run("undo");
    }
    assert.deepEqual(app.describe(), before);
    for (const _ of edits) {
      await app.run("redo");
    }
    assert.deepEqual(app.describe(), after);
    assert.equal(doc.findShape("pack"), replacement);
  }
});

test("failed grouping undo validates every affected parent before writing and can be retried", async () => {
  const app = editor();
  await runAll(app, ["init", "create g scene", "create g left in scene", "create g right in scene", "create circle a 1 2 3 in left", "create circle b 4 5 6 in right", "group pack a b"]);
  const doc = app.session.requireDocument();
  const right = doc.remove("right");
  doc.insert(new ShapeFactory().create("g", "right"), "scene", right.index);
  const before = app.describe();
  // 父列表中包含同名替代对象也应拒绝；不限定身份或列表校验的先后次序。
  await assert.rejects(app.run("undo"));
  assert.deepEqual(app.describe(), before);
  doc.remove("right");
  doc.restore(right);
  await app.run("undo");
  assert.equal(doc.findShape("b").parent, right.shape);
  const conflicting = new ShapeFactory().create("g", "pack");
  doc.insert(conflicting);
  const beforeRedo = app.describe();
  await assert.rejects(app.run("redo"), /id already exists: pack/);
  assert.deepEqual(app.describe(), beforeRedo);
  doc.remove("pack");
  await app.run("redo");
  assert.notEqual(doc.findShape("pack"), conflicting);
});

test("grouping restore rejects foreign records and changed lists without partial restoration", async () => {
  const app = editor();
  await runAll(app, ["init", "create g scene", "create circle a 1 2 3 in scene", "create circle b 4 5 6 in scene"]);
  const doc = app.session.requireDocument();
  const factory = new ShapeFactory();
  const change = doc.group(factory.create("g", "pack"), ["a", "b"]);
  assert.throws(() => new SvgDocument(100, 100).restoreGrouping(change, false), /belongs to another document/);
  // 外部移动改变了记录中的成员顺序，拒绝恢复而不覆盖这个变化。
  const movement = doc.sendToBack("b");
  const before = app.describe();
  assert.throws(() => doc.restoreGrouping(change, false), /group structure changed/);
  assert.deepEqual(app.describe(), before);
  doc.restorePlacement(movement.before);
  doc.restoreGrouping(change, false);
  assert.deepEqual(doc.findContainer("scene").children.map((shape) => shape.id), ["a", "b"]);
});
