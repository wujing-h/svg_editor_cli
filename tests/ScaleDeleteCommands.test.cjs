// 用途：验证缩放和删除的命令语义、局部恢复以及失败时保留文档和历史。
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

test("scale and delete require a document and reject invalid argument counts", async () => {
  const app = editor();
  for (const line of ["scale r1 2", "delete r1"]) {
    await assert.rejects(app.run(line), /no document\. use 'init' or 'read' first/);
  }
  await app.run("init");
  for (const line of ["scale", "scale r1", "scale r1 2 extra", "delete", "delete r1 extra"]) {
    await assert.rejects(app.run(line), /usage:/);
  }
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

const examples = [
  { kind: "rect", parameters: ".1 .2 1 2 red", attributes: { x: 0.30000000000000004, y: 0.6000000000000001, width: 3, height: 6, fill: "red" } },
  { kind: "circle", parameters: "1 2 3", attributes: { cx: 3, cy: 6, r: 9 } },
  { kind: "ellipse", parameters: "-1 2 3 4", attributes: { cx: -3, cy: 6, rx: 9, ry: 12 } },
  { kind: "line", parameters: "-1 -2 3 4 black", attributes: { x1: -3, y1: -6, x2: 9, y2: 12, stroke: "black" } },
  { kind: "text", parameters: '1 2 "  内容 <&>  "', attributes: { x: 3, y: 6 } },
  { kind: "g", parameters: "", attributes: {} },
];

for (const example of examples) {
  test(`scale ${example.kind} changes all geometry and restores exact saved values`, async () => {
    const app = editor();
    await app.run("init");
    await app.run(`create ${example.kind} s1 ${example.parameters}`);
    const shape = app.session.requireDocument().findShape("s1");
    const before = shape.describe();
    assert.deepEqual(await app.run("scale s1 3"), [`${example.kind}#s1 scaled by 3`]);
    const after = shape.describe();
    assert.deepEqual(after.attributes, example.attributes);
    assert.equal(after.text, before.text);
    for (let index = 0; index < 3; index += 1) {
      assert.deepEqual(await app.run("undo"), [`${example.kind}#s1 scale undone`]);
      assert.deepEqual(shape.describe(), before);
      await app.run("redo");
      assert.deepEqual(shape.describe(), after);
    }
    // 空组缩放也算一个编辑单元；第二次 undo 才撤销创建。
    await app.run("undo");
    await app.run("undo");
    assert.deepEqual(app.describe(), []);
  });
}

test("scale of a mixed nested group is a single edit and leaves hierarchy, styles, and text intact", async () => {
  const app = editor();
  await app.run("init");
  for (const line of [
    "create g scene", "create g nested in scene",
    "create rect r1 2 4 6 8 red in scene",
    "create circle c1 10 20 4 in nested",
    "create ellipse e1 30 40 6 8 in nested",
    "create line l1 -2 -4 6 8 black in nested",
    'create text t1 10 12 "文字" in nested',
  ]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const before = app.describe();
  await app.run("scale scene .5");
  const after = app.describe();
  assert.deepEqual(doc.findShape("r1").describe().attributes, { x: 1, y: 2, width: 3, height: 4, fill: "red" });
  assert.deepEqual(doc.findShape("c1").describe().attributes, { cx: 5, cy: 10, r: 2 });
  assert.deepEqual(doc.findShape("e1").describe().attributes, { cx: 15, cy: 20, rx: 3, ry: 4 });
  assert.deepEqual(doc.findShape("l1").describe().attributes, { x1: -1, y1: -2, x2: 3, y2: 4, stroke: "black" });
  assert.equal(doc.findShape("t1").describe().text, "文字");
  assert.equal(doc.findShape("t1").parent, doc.findShape("nested"));
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("redo");
  assert.deepEqual(app.describe(), after);
});

test("invalid or overflowing scales preserve the whole group and an existing redo entry", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create rect r1 1 2 3 4 in scene");
  await app.run("create circle large 1e308 0 1 in scene");
  await app.run("move r1 10 20");
  await app.run("undo");
  const before = app.describe();
  for (const factor of ["0", "-1"]) {
    await assert.rejects(app.run(`scale scene ${factor}`), /scale factor must be positive/);
  }
  for (const factor of ["NaN", "Infinity", "1e309", "0x2", "2px", '""']) {
    await assert.rejects(app.run(`scale scene ${factor}`), /invalid number:/);
  }
  await assert.rejects(app.run("scale scene 2"), /finite/);
  await assert.rejects(app.run("scale missing 2"), /no such shape: missing/);
  assert.deepEqual(app.describe(), before);
  await app.run("redo");
  assert.deepEqual(app.session.requireDocument().findShape("r1").describe().position, { x: 11, y: 22 });
  await app.run("undo");
  await app.run("scale r1 2");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("canvas 400 300");
  await assert.rejects(app.run("scale scene 2"), /finite/);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("deleting a middle child restores its original object, parent, and sibling order", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  for (const id of ["first", "middle", "last"]) {
    await app.run(`create circle ${id} 1 2 3 in scene`);
  }
  const doc = app.session.requireDocument();
  const parent = doc.findContainer("scene");
  const middle = doc.findShape("middle");
  const before = app.describe();
  assert.deepEqual(await app.run("delete middle"), ["circle#middle deleted"]);
  for (let index = 0; index < 2; index += 1) {
    assert.deepEqual(parent.children.map((shape) => shape.id), ["first", "last"]);
    assert.throws(() => doc.findShape("middle"), /no such shape:/);
    assert.equal(middle.parent, undefined);
    assert.equal(middle.document, undefined);
    assert.deepEqual(await app.run("undo"), ["circle#middle restored into g#scene"]);
    assert.equal(doc.findShape("middle"), middle);
    assert.equal(middle.parent, parent);
    assert.deepEqual(app.describe(), before);
    await app.run("redo");
  }
});

test("deleting a root group removes the whole subtree and restores all identities and root order", async () => {
  const app = editor();
  await app.run("init");
  for (const line of [
    "create g first", "create g scene", "create g last",
    "create g nested in scene", "create circle c1 1 2 3 in nested",
    'create text t1 4 5 "文本" in scene',
  ]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const ids = ["scene", "nested", "c1", "t1"];
  const shapes = ids.map((id) => doc.findShape(id));
  const before = app.describe();
  await app.run("delete scene");
  assert.deepEqual(doc.getRootShapes().map((shape) => shape.id), ["first", "last"]);
  for (const shape of shapes) {
    assert.throws(() => doc.findShape(shape.id), /no such shape:/);
    assert.equal(shape.document, undefined);
  }
  // 摘下根的外部归属被清除，子树内部父子关系仍保留。
  assert.equal(shapes[0].parent, undefined);
  assert.equal(shapes[1].parent, shapes[0]);
  assert.equal(shapes[2].parent, shapes[1]);
  assert.deepEqual(await app.run("undo"), ["g#scene restored into svg"]);
  assert.deepEqual(app.describe(), before);
  for (const shape of shapes) {
    assert.equal(doc.findShape(shape.id), shape);
    assert.equal(shape.document, doc);
  }
  await app.run("redo");
  assert.deepEqual(doc.getRootShapes().map((shape) => shape.id), ["first", "last"]);
});

test("failed deletes preserve redo and IO restrictions; successful delete clears redo and keeps an empty parent", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create circle c1 1 2 3 in scene");
  await app.run("move c1 10 20");
  await app.run("undo");
  const before = app.describe();
  await assert.rejects(app.run("delete missing"), /no such shape: missing/);
  await assert.rejects(app.run("delete c1 extra"), /usage:/);
  assert.deepEqual(app.describe(), before);
  await app.run("redo");
  await app.run("undo");
  await app.run("delete c1");
  assert.deepEqual(app.session.requireDocument().findContainer("scene").children, []);
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("canvas 400 300");
  await assert.rejects(app.run("delete missing"), /no such shape:/);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("interleaved create, move, scale, delete, and id reuse restore the correct objects", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create circle c1 1 2 3");
  const doc = app.session.requireDocument();
  const original = doc.findShape("c1");
  const initial = original.describe();
  await app.run("move c1 10 20");
  const moved = original.describe();
  await app.run("scale c1 2");
  const scaled = original.describe();
  await app.run("delete c1");
  await app.run("create circle c1 100 200 30");
  const replacement = doc.findShape("c1");
  assert.notEqual(replacement, original);
  await app.run("undo");
  await app.run("undo");
  assert.equal(doc.findShape("c1"), original);
  assert.deepEqual(original.describe(), scaled);
  await app.run("undo");
  assert.deepEqual(original.describe(), moved);
  await app.run("undo");
  assert.deepEqual(original.describe(), initial);
  await app.run("undo");
  assert.deepEqual(app.describe(), []);
  for (let index = 0; index < 5; index += 1) {
    await app.run("redo");
  }
  assert.equal(doc.findShape("c1"), replacement);
  assert.equal(original.document, undefined);
});

test("a failed delete undo or redo preserves both the document and the retryable history entry", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create circle c1 1 2 3");
  const doc = app.session.requireDocument();
  const original = doc.findShape("c1");
  await app.run("delete c1");
  // 模拟恢复前的同名对象冲突；命令失败不能把已有对象移走。
  const replacement = new CircleShape("c1", 10, 20, 30);
  doc.insert(replacement);
  const before = app.describe();
  await assert.rejects(app.run("undo"), /id already exists: c1/);
  assert.deepEqual(app.describe(), before);
  doc.remove("c1");
  await app.run("undo");
  assert.equal(doc.findShape("c1"), original);
  const originalLocation = doc.remove("c1");
  doc.insert(replacement);
  await assert.rejects(app.run("redo"), /delete target is no longer in this document/);
  assert.deepEqual(app.describe(), before);
  doc.remove("c1");
  doc.restore(originalLocation);
  await app.run("redo");
  assert.deepEqual(app.describe(), []);
});
