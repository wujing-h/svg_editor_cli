// 用途：验证树形与属性查询的可观察输出，以及只读命令保持文档和历史。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");

function editor() {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  const query = async (line) => dispatcher.dispatch(parser.parse(line));
  return { session, query, run: async (line) => formatter.format(await query(line)) };
}

test("tree renders all six types, nested connectors, geometry, and explicit styles", async () => {
  const app = editor();
  for (const line of [
    "init 400 300", "create g scene", "create rect r 0 1 2 3 #fff in scene",
    "create g nested in scene", "create circle c 4 5 6 red in nested",
    "create ellipse e 7 8 9 10 in nested", "create line l 11 12 13 14 black in scene",
    'create text t 15 16 "a b" in scene', "create g tail",
  ]) {
    await app.run(line);
  }
  const lines = await app.run("tree");
  assert.equal(lines[0], "svg (400x300)");
  assert.equal(lines[1], "├── g#scene");
  assert.match(lines[2], /^│   ├── rect#r +x=0 y=1 w=2 h=3 fill=#fff$/);
  assert.equal(lines[3], "│   ├── g#nested");
  assert.match(lines[4], /^│   │   ├── circle#c +cx=4 cy=5 r=6 fill=red$/);
  assert.match(lines[5], /^│   │   └── ellipse#e +cx=7 cy=8 rx=9 ry=10$/);
  assert.match(lines[6], /^│   ├── line#l +\(11,12\) -> \(13,14\) stroke=black$/);
  assert.match(lines[7], /^│   └── text#t +\(15,16\) "a b"$/);
  assert.equal(lines[8], "└── g#tail");
  assert.equal(lines.length, 9);
});

test("tree handles an empty document, a selected subtree, and a single leaf", async () => {
  const app = editor();
  await app.run("init");
  assert.deepEqual(await app.run("tree"), ["svg (800x600)"]);
  await app.run("create g scene");
  await app.run("create circle c 1 2 3 in scene");
  assert.deepEqual(await app.run("tree scene"), ["g#scene", "└── circle#c  cx=1 cy=2 r=3"]);
  assert.deepEqual(await app.run("tree c"), ["circle#c  cx=1 cy=2 r=3"]);
});

test("show reports native geometry names, parent, styles, text, and container child count", async () => {
  const app = editor();
  for (const line of ["init", "create g scene", "create circle c 100 100 20 red in scene", "set c stroke-width 2", "create rect r 1 2 3 4", 'create text t 5 6 "a b" in scene']) {
    await app.run(line);
  }
  assert.deepEqual(await app.run("show c"), ["circle#c  parent=g#scene", "  cx=100 cy=100 r=20", "  fill=red", "  stroke-width=2"]);
  assert.deepEqual(await app.run("show r"), ["rect#r  parent=svg", "  x=1 y=2 width=3 height=4"]);
  assert.deepEqual(await app.run("show t"), ["text#t  parent=g#scene", "  x=5 y=6", '  text="a b"']);
  assert.deepEqual(await app.run("show scene"), ["g#scene  parent=svg", "  children=2"]);
});

test("display errors and successful queries preserve undo, redo, and IO restrictions", async () => {
  const app = editor();
  await assert.rejects(app.run("tree"), /no document/);
  await assert.rejects(app.run("show c"), /no document/);
  for (const line of ["init", "create circle c 1 2 3", "move c 10 20", "undo"]) {
    await app.run(line);
  }
  await app.run("tree");
  await app.run("show c");
  for (const line of ["tree a b", "show", "show c extra", "tree missing", "show missing"]) {
    await assert.rejects(app.run(line));
  }
  await app.run("redo");
  assert.deepEqual(app.session.requireDocument().findShape("c").describe().position, { x: 11, y: 22 });
  await app.run("tree");
  await app.run("undo");
  assert.deepEqual(app.session.requireDocument().findShape("c").describe().position, { x: 1, y: 2 });
  await app.run("canvas 400 300");
  await app.run("tree");
  await app.run("show c");
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("query descriptions are independent and text controls stay on one display line", async () => {
  const app = editor();
  await app.run("init");
  await app.run("create g scene");
  await app.run("create text t 1 2 content in scene");
  // 词法层只转义引号和反斜杠；这里直接设置真实控制字符，验证展示层。
  app.session.requireDocument().findShape("t").setAttribute("text", 'a\nb\t"c');
  const tree = await app.query("tree");
  tree.tree.roots[0].children[0].geometry.x = 999;
  tree.tree.roots[0].children[0].attributes.x = 999;
  tree.tree.roots.length = 0;
  const show = await app.query("show t");
  show.shapeDetails.parent.id = "changed";
  show.shapeDetails.shape.geometry.x = 999;
  const doc = app.session.requireDocument();
  assert.equal(doc.findShape("t").parent.id, "scene");
  assert.equal(doc.findShape("t").describe().attributes.x, 1);
  const lines = await app.run("tree t");
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'text#t  (1,2) "a\\nb\\t\\\"c"');
});
