// 用途：验证真实文件读取、缺 id 警告、失败原子性、历史限制及完整读写会话。
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { SvgFileStore } = require("../dist/infrastructure/SvgFileStore.js");
const { SvgReader } = require("../dist/infrastructure/SvgReader.js");

const svg = (children) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">${children}</svg>`;

function editor(store = new SvgFileStore()) {
  const session = new EditorSession(store);
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  return {
    session,
    run: async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line))),
    describe: () => session.requireDocument().getRootShapes().map((shape) => shape.describe()),
  };
}

async function fixture(t) {
  const root = path.resolve(__dirname, "../ai-notes/staging");
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, "read-test-"));
  t.after(async () => {
    if (path.dirname(path.resolve(directory)) !== root) {
      throw new Error("test cleanup escaped staging directory");
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function fileCommand(name, filePath) {
  return `${name} "${filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

test("read validates arguments and file errors while remaining available before init", async (t) => {
  const directory = await fixture(t);
  const app = editor();
  await assert.rejects(app.run("read"), /usage: read/);
  await assert.rejects(app.run("read a.svg b.svg"), /usage: read/);
  await assert.rejects(app.run('read ""'), /file path must not be empty/);
  await assert.rejects(app.run(fileCommand("read", path.join(directory, "missing.svg"))), /cannot read file:/);
  assert.throws(() => app.session.requireDocument(), /no document/);
  const file = path.join(directory, "empty.svg");
  await fs.writeFile(file, svg(""), "utf8");
  assert.deepEqual(await app.run(fileCommand("read", file)), [`read ${file} (0 elements)`]);
  assert.deepEqual(app.session.getCanvasSize(), { width: 400, height: 300 });
});

test("successful reading reports missing IDs before its summary and retains nested text presentation", async (t) => {
  const directory = await fixture(t);
  const file = path.join(directory, "my diagram.svg");
  await fs.writeFile(file, svg('<rect width="10" height="20"/><rect id="rect1"/><g font-size="16" text-anchor="middle"><text x="1" y="2">  中文 &amp; text  </text><circle r="3"/></g>'), "utf8");
  const app = editor();
  assert.deepEqual(await app.run(fileCommand("read", file)), [
    "warning: assigned id rect2 to unnamed <rect>", "warning: assigned id g1 to unnamed <g>",
    "warning: assigned id text1 to unnamed <text>", "warning: assigned id circle1 to unnamed <circle>",
    `read ${file} (5 elements)`,
  ]);
  const doc = app.session.requireDocument();
  assert.equal(doc.findShape("text1").parent.id, "g1");
  assert.equal(doc.findShape("text1").describe().text, "  中文 & text  ");
  assert.deepEqual(await app.run("show g1"), ["g#g1  parent=svg", "  font-size=16", "  text-anchor=middle", "  children=2"]);
  await app.run("move text1 10 20");
  await app.run("undo");
  await assert.rejects(app.run("set text1 font-size 20"), /unknown attribute: font-size/);
  await app.run("redo");
  await app.run("scale g1 2");
  await app.run("save");
  const saved = await fs.readFile(file, "utf8");
  assert.match(saved, /<g id="g1" font-size="16" text-anchor="middle">/);
  assert.match(saved, /<text id="text1" x="22" y="44">  中文 &amp; text  <\/text>/);
  const before = app.describe();
  assert.deepEqual(await app.run(fileCommand("read", file)), [`read ${file} (5 elements)`]);
  assert.deepEqual(app.describe(), before);
});

test("failed reads preserve the original object tree, redo, association, and source files without outputting warnings", async (t) => {
  const directory = await fixture(t);
  const original = path.join(directory, "original.svg");
  await fs.writeFile(original, svg('<g id="scene"><circle id="c" cx="1" cy="2" r="3"/></g>'), "utf8");
  const app = editor();
  await app.run(fileCommand("read", original));
  await app.run("move c 10 20");
  await app.run("undo");
  const doc = app.session.requireDocument();
  const circle = doc.findShape("c");
  const before = app.describe();
  const invalidFiles = [
    svg('<rect/><g transform="translate(1,2)"/>'), svg('<g id="same"><circle id="same"/></g>'),
    '<svg width="400" height="300"><g>', svg('<circle r="-1"/>'),
    '<svg width="400" height="300" viewBox="0 0 800 600"/>',
  ];
  for (const [index, content] of invalidFiles.entries()) {
    const file = path.join(directory, `invalid-${index}.svg`);
    await fs.writeFile(file, content, "utf8");
    await assert.rejects(app.run(fileCommand("read", file)));
    assert.equal(app.session.requireDocument(), doc);
    assert.equal(doc.findShape("c"), circle);
    assert.deepEqual(app.describe(), before);
    assert.equal(await fs.readFile(file, "utf8"), content);
  }
  await app.run("redo");
  assert.deepEqual(circle.describe().position, { x: 11, y: 22 });
  await app.run("save");
  assert.match(await fs.readFile(original, "utf8"), /cx="11" cy="22"/);
  assert.deepEqual((await fs.readdir(directory)).sort(), ["invalid-0.svg", "invalid-1.svg", "invalid-2.svg", "invalid-3.svg", "invalid-4.svg", "original.svg"]);
});

test("successful read clears both old history stacks and changes the default save path only after success", async (t) => {
  const directory = await fixture(t);
  const oldPath = path.join(directory, "old.svg");
  const newPath = path.join(directory, "new.svg");
  await fs.writeFile(newPath, svg('<circle id="new" cx="10" cy="20" r="30"/>'), "utf8");
  const app = editor();
  for (const line of ["init", "create circle old 1 2 3", fileCommand("save", oldPath), "move old 10 20", "undo"]) {
    await app.run(line);
  }
  const oldDocument = app.session.requireDocument();
  const oldFile = await fs.readFile(oldPath, "utf8");
  await app.run(fileCommand("read", newPath));
  assert.notEqual(app.session.requireDocument(), oldDocument);
  for (const command of ["undo", "redo"]) {
    await assert.rejects(app.run(command), /undo not allowed after io command/);
  }
  await assert.rejects(app.run(fileCommand("read", path.join(directory, "missing.svg"))));
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
  await app.run("move new 1 2");
  await app.run("undo");
  await assert.rejects(app.run("undo"), /nothing to undo/);
  await app.run("redo");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  await app.run("save");
  assert.equal(await fs.readFile(oldPath, "utf8"), oldFile);
  assert.match(await fs.readFile(newPath, "utf8"), /cx="11" cy="22"/);
});

test("file reader rejects invalid UTF-8, directories, and empty files without creating a document", async (t) => {
  const directory = await fixture(t);
  const invalid = path.join(directory, "invalid.svg");
  const empty = path.join(directory, "empty.svg");
  await fs.writeFile(invalid, Buffer.from([0xff, 0xfe, 0x00]));
  await fs.writeFile(empty, "", "utf8");
  const app = editor();
  await assert.rejects(app.run(fileCommand("read", invalid)), /cannot read file:/);
  await assert.rejects(app.run(fileCommand("read", directory)), /cannot read file:/);
  await assert.rejects(app.run(fileCommand("read", empty)), /invalid SVG XML/);
  assert.throws(() => app.session.requireDocument(), /no document/);
});

test("session replaces its document only after asynchronous reading completes", async () => {
  let complete;
  const loaded = new SvgReader().parse(svg('<circle id="imported" r="3"/>'));
  const app = editor({ read: () => new Promise((resolve) => { complete = resolve; }), save: async () => 0 });
  await app.run("init");
  await app.run("create circle old 1 2 3");
  const old = app.session.requireDocument();
  const pending = app.run("read pending.svg");
  assert.equal(app.session.requireDocument(), old);
  complete(loaded);
  assert.deepEqual(await pending, ["read pending.svg (1 elements)"]);
  assert.equal(app.session.requireDocument(), loaded.document);
  assert.equal(old.findShape("old").id, "old");
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("CLI completes the assignment's imported SVG session, warning once and preserving sequential read/save", async (t) => {
  const directory = await fixture(t);
  const source = svg('<rect x="0" y="0" width="400" height="300" fill="#ffffff"/><text id="t1" x="10" y="290">imported</text><circle id="c1" cx="50" cy="50" r="10"/><g id="g1"><rect id="r2" x="0" y="0" width="10" height="10"/><circle id="c2" cx="5" cy="5" r="2"/></g><ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>');
  await fs.writeFile(path.join(directory, "other.svg"), source, "utf8");
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../dist/main.js")], {
    cwd: directory,
    input: "read missing.svg\ncanvas\nread other.svg\nundo\ntree\nshow c1\nmove c1 30 0\nundo\nredo\nsave demo.svg\nread demo.svg\nshow c1\nsave\nundo\n",
    encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /error: cannot read file: missing.svg/);
  assert.match(result.stdout, /warning: assigned id rect1 to unnamed <rect>\nread other.svg \(7 elements\)\nerror: undo not allowed after io command\nsvg \(400x300\)/);
  assert.match(result.stdout, /rect#rect1 +x=0 y=0 w=400 h=300 fill=#ffffff/);
  assert.match(result.stdout, /circle#c1  parent=svg\n  cx=80 cy=50 r=10/);
  assert.match(result.stdout, /saved to demo.svg \(7 elements\)\nread demo.svg \(7 elements\)/);
  assert.equal((result.stdout.match(/^warning:/gm) ?? []).length, 1);
  const content = await fs.readFile(path.join(directory, "demo.svg"), "utf8");
  assert.equal(new SvgReader().parse(content).elementCount, 7);
  assert.equal(await fs.readFile(path.join(directory, "other.svg"), "utf8"), source);
});
