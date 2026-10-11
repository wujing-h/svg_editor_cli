// 用途：验证 set 的 CLI 语义、属性缺失恢复、容器样式和编辑历史原子性。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");

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

test("set requires a document, exactly three arguments, and an existing target", async () => {
  const app = editor();
  await assert.rejects(app.run("set r1 x 10"), /no document/);
  await app.run("init");
  for (const line of ["set", "set r1", "set r1 x", "set r1 x 1 extra"]) {
    await assert.rejects(app.run(line), /usage: set/);
  }
  await assert.rejects(app.run("set missing fill red"), /no such shape: missing/);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("set undo distinguishes missing styles from empty strings, none, and zero", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create circle c1 1 2 3");
  const shape = app.session.requireDocument().findShape("c1");
  for (const [attribute, input, expected] of [["fill", "none", "none"], ["stroke", '""', ""], ["stroke-width", "0", 0]]) {
    const before = shape.describe();
    await app.run(`set c1 ${attribute} ${input}`);
    const after = shape.describe();
    assert.equal(after.attributes[attribute], expected);
    assert.deepEqual(await app.run("undo"), [`circle#c1 updated: ${attribute}=(unset)`]);
    assert.deepEqual(shape.describe(), before);
    await app.run("redo");
    assert.deepEqual(shape.describe(), after);
  }
  await app.run('set c1 stroke "black"');
  assert.deepEqual(await app.run("undo"), ['circle#c1 updated: stroke=""']);
  await app.run("set c1 stroke-width 2");
  assert.deepEqual(await app.run("undo"), ["circle#c1 updated: stroke-width=0"]);
});

test("set changes and restores a group style without overwriting descendants", async () => {
  const app = editor();
  await app.run("init");
  for (const line of ["create g scene", "create g nested in scene", "create circle explicit 1 2 3 blue in nested", "create circle inherited 4 5 6 in nested"]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const children = doc.findContainer("scene").describe().children;
  await app.run("set scene fill red");
  assert.equal(doc.findShape("scene").describe().attributes.fill, "red");
  assert.deepEqual(doc.findContainer("scene").describe().children, children);
  await app.run("undo");
  assert.equal(Object.hasOwn(doc.findShape("scene").describe().attributes, "fill"), false);
  await app.run("redo");
  await app.run("set scene fill green");
  await app.run("undo");
  assert.equal(doc.findShape("scene").describe().attributes.fill, "red");
  assert.deepEqual(doc.findContainer("scene").describe().children, children);
  assert.equal(doc.findShape("explicit").describe().attributes.fill, "blue");
  assert.equal(Object.hasOwn(doc.findShape("inherited").describe().attributes, "fill"), false);
});

test("set text preserves quoted content, empty text, and safe one-line summaries", async () => {
  const app = editor();
  await app.run("init");
  await app.run('create text title 20 40 "My Diagram"');
  assert.deepEqual(await app.run('set title text "My Diagram v2"'), ['text#title updated: text="My Diagram v2"']);
  assert.deepEqual(await app.run("undo"), ['text#title updated: text="My Diagram"']);
  await app.run("redo");
  const text = app.session.requireDocument().findShape("title");
  for (const content of ["", "  in <&> #red  ", '引号 " 与反斜杠 \\', "换行\n下一行"]) {
    const input = content.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const before = text.describe();
    const lines = await app.run(`set title text "${input}"`);
    assert.deepEqual(lines, [`text#title updated: text=${JSON.stringify(content)}`]);
    assert.equal(text.describe().text, content);
    assert.equal(lines[0].includes("\n"), false);
    await app.run("undo");
    assert.deepEqual(text.describe(), before);
    await app.run("redo");
    assert.equal(text.describe().text, content);
  }
});

test("failed set preserves the document, redo entries, and IO restrictions", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create rect r1 1 2 3 4 in scene");
  await app.run("set r1 x 10");
  await app.run("undo");
  const before = app.describe();
  for (const [line, error] of [
    ["set r1 width -1", /non-negative/],
    ["set r1 x Infinity", /invalid number/],
    ["set r1 stroke-width -1", /non-negative/],
    ["set r1 id changed", /unknown attribute: id/],
    ["set r1 text content", /unknown attribute: text/],
    ["set r1 cx 2", /unknown attribute: cx/],
    ["set scene x 2", /unknown attribute: x/],
    ["set r1 transform translate", /unknown attribute: transform/],
  ]) {
    await assert.rejects(app.run(line), error);
    assert.deepEqual(app.describe(), before);
  }
  await app.run("redo");
  assert.equal(app.session.requireDocument().findShape("r1").describe().attributes.x, 10);
  await app.run("undo");
  await app.run("set r1 fill #ff0000");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
  await app.run("canvas 400 300");
  await assert.rejects(app.run("set r1 width -1"));
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
  await app.run("set r1 height 0");
  await app.run("undo");
  assert.deepEqual(app.describe(), before);
});

test("set, move, scale, and delete share history and restore original geometry and styles", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create rect r1 1 2 3 4");
  const doc = app.session.requireDocument();
  const shape = doc.findShape("r1");
  const before = shape.describe();
  await app.run("set r1 fill red");
  await app.run("set r1 x .1");
  await app.run("move r1 .2 10");
  await app.run("scale r1 3");
  const after = shape.describe();
  await app.run("delete r1");
  for (let index = 0; index < 5; index += 1) {
    await app.run("undo");
  }
  assert.equal(doc.findShape("r1"), shape);
  assert.deepEqual(shape.describe(), before);
  for (let index = 0; index < 5; index += 1) {
    await app.run("redo");
  }
  assert.deepEqual(app.describe(), []);
  await app.run("undo");
  assert.equal(doc.findShape("r1"), shape);
  assert.deepEqual(shape.describe(), after);
});

test("set restoration rejects same-id replacements and retains history for retry", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create rect r1 1 2 3 4");
  await app.run("set r1 fill red");
  const doc = app.session.requireDocument();
  const location = doc.remove("r1");
  const replacement = new ShapeFactory().create("rect", "r1", { x: 10, y: 20, width: 30, height: 40 });
  doc.insert(replacement);
  const before = app.describe();
  await assert.rejects(app.run("undo"), /set target is no longer in this document/);
  assert.deepEqual(app.describe(), before);
  doc.remove("r1");
  doc.restore(location);
  await app.run("undo");
  assert.equal(Object.hasOwn(location.shape.describe().attributes, "fill"), false);
  await app.run("redo");
  assert.equal(location.shape.describe().attributes.fill, "red");
});
