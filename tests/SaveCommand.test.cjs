// 用途：验证真实 SVG 保存、关联路径、失败原子性及 IO 历史限制；测试文件限于项目内。
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

function editor(store = new SvgFileStore()) {
  const session = new EditorSession(store);
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  return { session, run: async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line))) };
}

async function fixture(t) {
  const root = path.resolve(__dirname, "../ai-notes/staging");
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, "save-test-"));
  t.after(async () => {
    // 只删除本测试新建、且绝对路径位于 staging 下的目录。
    if (path.dirname(path.resolve(directory)) !== root) {
      throw new Error("test cleanup escaped staging directory");
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function saveLine(filePath) {
  // 命令词法层的路径引用规则：转义反斜杠和双引号。
  return `save "${filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

test("save requires a document, at most one path, and a nonempty associated or explicit path", async () => {
  const app = editor();
  await assert.rejects(app.run("save file.svg"), /no document/);
  await app.run("init");
  await assert.rejects(app.run("save"), /no file path/);
  await assert.rejects(app.run('save ""'), /file path must not be empty/);
  await assert.rejects(app.run("save a.svg b.svg"), /usage: save/);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("real saving replaces a file, supports spaces and default paths, and clears both history stacks", async (t) => {
  const directory = await fixture(t);
  const target = path.join(directory, "my diagram.svg");
  await fs.writeFile(target, "previous content", "utf8");
  const app = editor();
  for (const line of ["init 400 300", "create g scene", 'create text t 1 2 "中文 <&>" in scene', "move t 10 20", "undo"]) {
    await app.run(line);
  }
  const doc = app.session.requireDocument();
  const shape = doc.findShape("t");
  const before = doc.getRootShapes().map((node) => node.describe());
  assert.deepEqual(await app.run(saveLine(target)), [`saved to ${target} (2 elements)`]);
  const first = await fs.readFile(target, "utf8");
  assert.match(first, /<text id="t" x="1" y="2">中文 &lt;&amp;&gt;<\/text>/);
  assert.deepEqual(doc.getRootShapes().map((node) => node.describe()), before);
  for (const command of ["undo", "redo"]) {
    await assert.rejects(app.run(command), /undo not allowed after io command/);
  }
  await app.run("move t 3 4");
  await app.run("undo");
  await app.run("redo");
  assert.equal(doc.findShape("t"), shape);
  await app.run("save");
  assert.match(await fs.readFile(target, "utf8"), /x="4" y="6"/);
  assert.deepEqual(await fs.readdir(directory), ["my diagram.svg"]);
});

test("failed writes preserve the document, redo, old file, and associated path and clean temporary files", async (t) => {
  const directory = await fixture(t);
  const target = path.join(directory, "original.svg");
  const blocked = path.join(directory, "directory.svg");
  await fs.mkdir(blocked);
  await fs.writeFile(path.join(blocked, "sentinel"), "untouched", "utf8");
  const app = editor();
  for (const line of ["init", "create circle c 1 2 3", saveLine(target), "move c 10 20", "undo"]) {
    await app.run(line);
  }
  const original = await fs.readFile(target, "utf8");
  const doc = app.session.requireDocument();
  const before = doc.getRootShapes().map((shape) => shape.describe());
  await assert.rejects(app.run(saveLine(blocked)), /cannot write file:/);
  await assert.rejects(app.run(saveLine(path.join(directory, "missing", "file.svg"))), /cannot write file:/);
  assert.deepEqual(doc.getRootShapes().map((shape) => shape.describe()), before);
  assert.equal(await fs.readFile(target, "utf8"), original);
  assert.equal(await fs.readFile(path.join(blocked, "sentinel"), "utf8"), "untouched");
  assert.deepEqual((await fs.readdir(directory)).sort(), ["directory.svg", "original.svg"]);
  await app.run("redo");
  assert.deepEqual(doc.findShape("c").describe().position, { x: 11, y: 22 });
  await app.run("undo");
  await app.run("save");
  assert.equal(await fs.readFile(target, "utf8"), original);
  await assert.rejects(app.run(saveLine(blocked)), /cannot write file:/);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("serialization failure preserves an existing file, association, and undo", async (t) => {
  const directory = await fixture(t);
  const target = path.join(directory, "safe.svg");
  const other = path.join(directory, "other.svg");
  await fs.writeFile(other, "do not replace", "utf8");
  const app = editor();
  await app.run("init");
  await app.run("create text t 1 2 valid");
  await app.run(saveLine(target));
  const shape = app.session.requireDocument().findShape("t");
  // 已解析的命令允许字符串内容；非法 XML 字符由序列化边界拒绝。
  await app.run('set t text "bad\u0000text"');
  await assert.rejects(app.run(saveLine(other)), /invalid XML character/);
  assert.equal(await fs.readFile(other, "utf8"), "do not replace");
  assert.equal(shape.describe().text, "bad\u0000text");
  await app.run("undo");
  assert.equal(shape.describe().text, "valid");
  await app.run("save");
  assert.match(await fs.readFile(target, "utf8"), />valid<\/text>/);
});

test("explicit save updates the default path, canvas keeps it, and only successful init clears it", async () => {
  const paths = [];
  const store = { save: async (_document, filePath) => { paths.push(filePath); return 0; } };
  const app = editor(store);
  await app.run("init");
  await app.run("save first.svg");
  await app.run("save second.svg");
  await app.run("canvas 400 300");
  await app.run("save");
  assert.deepEqual(paths, ["first.svg", "second.svg", "second.svg"]);
  await assert.rejects(app.run("init 0 100"));
  await app.run("save");
  assert.equal(paths.at(-1), "second.svg");
  await app.run("init");
  await assert.rejects(app.run("save"), /no file path/);
});

test("save waits for asynchronous storage before reporting success and applying its IO restriction", async () => {
  let complete;
  const store = { save: () => new Promise((resolve) => { complete = resolve; }) };
  const app = editor(store);
  await app.run("init");
  await app.run("create circle c 1 2 3");
  const saving = app.run("save demo.svg");
  assert.equal(typeof complete, "function");
  assert.equal(app.session.requireDocument().findShape("c").id, "c");
  complete(1);
  assert.deepEqual(await saving, ["saved to demo.svg (1 elements)"]);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("CLI replays the assignment session through SVG save and preserves sequential IO behavior", async (t) => {
  const directory = await fixture(t);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../dist/main.js")], {
    cwd: directory,
    input: [
      "init 800 600", "create rect bg 0 0 800 600 #ffffff", 'create text title 20 40 "My Diagram"',
      "create circle c1 100 100 20 red", "create rect box 200 80 60 60 #3366ff", "group markers c1 box", "tree",
      "move c1 30 0", "undo", "redo", 'set title text "My Diagram v2"', "undo", "group bad c1 markers",
      "delete box", "undo", "show c1", "save demo.svg", "undo", "save", "canvas", "",
    ].join("\n"),
    encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /svg \(800x600\)/);
  assert.match(result.stdout, /rect#bg +x=0 y=0 w=800 h=600 fill=#ffffff/);
  assert.match(result.stdout, /text#title +\(20,40\) "My Diagram"/);
  assert.match(result.stdout, /circle#c1  parent=g#markers\n  cx=130 cy=100 r=20\n  fill=red/);
  assert.match(result.stdout, /error: cannot group a container into its own descendant: markers/);
  assert.match(result.stdout, /saved to demo.svg \(5 elements\)\nerror: undo not allowed after io command\nsaved to demo.svg \(5 elements\)\ncanvas 800x600/);
  const content = await fs.readFile(path.join(directory, "demo.svg"), "utf8");
  assert.match(content, /<circle id="c1" cx="130" cy="100" r="20" fill="red"\/>/);
  assert.match(content, /<text id="title" x="20" y="40">My Diagram<\/text>/);
  assert.deepEqual(await fs.readdir(directory), ["demo.svg"]);
});
