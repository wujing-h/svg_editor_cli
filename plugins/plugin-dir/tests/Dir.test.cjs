// 用途：以目录端口和注册替身独立验证 dir，不加载宿主或其他插件。
const assert = require("node:assert/strict");
const test = require("node:test");
const { DirCommand, DirPlugin } = require("../dist/index.js");
const manifest = require("../package.json");

const entry = (name, kind) => Object.freeze({ name, kind });
const run = async (entries) => new DirCommand({
  getCurrentDirectory: () => "fixture", readDirectory: async (target) => {
    assert.equal(target, "fixture");
    return entries;
  },
}, []).execute();

test("directories precede files and each group uses explicit name order including hidden entries", async () => {
  const entries = Object.freeze([
    entry("b.txt", "file"), entry("z-dir", "directory"), entry("A.txt", "file"),
    entry(".hidden", "file"), entry("a-dir", "directory"), entry("a.txt", "file"),
  ]);
  const before = [...entries];
  assert.deepEqual((await run(entries)).lines, [
    "[DIR]  a-dir", "[DIR]  z-dir", "[FILE]  .hidden", "[FILE]  A.txt", "[FILE]  a.txt", "[FILE]  b.txt",
  ]);
  assert.deepEqual(entries, before);
});

test("links and other special entries follow ordinary files without being traversed", async () => {
  assert.deepEqual((await run([
    entry("z-link", "link"), entry("a-other", "other"), entry("a-link", "link"),
    entry("z-file", "file"), entry("z-other", "other"), entry("z-dir", "directory"),
  ])).lines, ["[DIR]  z-dir", "[FILE]  z-file", "[LINK]  a-link", "[LINK]  z-link", "[OTHER]  a-other", "[OTHER]  z-other"]);
});

test("empty directories and dot-only responses use the specified empty message", async () => {
  assert.deepEqual((await run([])).lines, ["(empty directory)"]);
  assert.deepEqual((await run([entry(".", "directory"), entry("..", "directory")])).lines, ["(empty directory)"]);
});

test("one query reads exactly the current directory once and later executions query fresh content", async () => {
  let cwd = "one";
  const targets = [];
  const command = new DirCommand({ getCurrentDirectory: () => cwd, readDirectory: async (target) => {
    targets.push(target);
    return [entry(`${target}.txt`, "file")];
  } }, []);
  assert.deepEqual((await command.execute()).lines, ["[FILE]  one.txt"]);
  cwd = "two";
  assert.deepEqual((await command.execute()).lines, ["[FILE]  two.txt"]);
  assert.deepEqual(targets, ["one", "two"]);
});

test("read failures use the required target path and the same command remains usable", async () => {
  let fail = true;
  const command = new DirCommand({ getCurrentDirectory: () => "C:\\demo", readDirectory: async () => {
    if (fail) throw new Error("adapter-specific details");
    return [];
  } }, []);
  await assert.rejects(command.execute(), { message: "cannot read directory: C:\\demo" });
  fail = false;
  assert.deepEqual((await command.execute()).lines, ["(empty directory)"]);
});

test("parameters fail before consulting any directory service", async () => {
  const command = new DirCommand({ getCurrentDirectory: () => assert.fail("no query expected") }, [{ value: "folder", quoted: false }]);
  await assert.rejects(command.execute(), /usage: dir/);
});

test("names with spaces stay intact and control characters stay on a single display line", async () => {
  assert.deepEqual((await run([entry("a file.txt", "file"), entry("line\nbreak", "file"), entry("unicode\u2028line", "file")])).lines,
    ["[FILE]  a file.txt", '[FILE]  "line\\nbreak"', '[FILE]  "unicode\\u2028line"']);
});

test("plugin metadata agrees with the package and it only needs the directory capability", async () => {
  let definition;
  new DirPlugin().activate({ services: { directory: { getCurrentDirectory: () => "current", readDirectory: async () => [] } },
    registerCommand: (value) => { definition = value; } });
  assert.deepEqual(manifest.contributes.commands, [definition.name]);
  assert.equal(definition.syntax, "dir");
  assert.notEqual(definition.create([]), definition.create([]));
  assert.deepEqual((await definition.create([]).execute()).lines, ["(empty directory)"]);
});

test("unsupported plugin options fail before command registration", () => {
  assert.throws(() => new DirPlugin().activate({ registerCommand: () => assert.fail("must not register") }, {}), /dir plugin does not accept options/);
});
