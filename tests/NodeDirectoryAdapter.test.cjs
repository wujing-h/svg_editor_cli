// 用途：用真实临时目录验证目录适配器的直接子项、隐藏项、错误和 cwd 查询。
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { NodeDirectoryAdapter } = require("../dist/infrastructure/NodeDirectoryAdapter.js");

async function directory(t) {
  const root = path.resolve(__dirname, "../ai-notes/staging");
  await fs.mkdir(root, { recursive: true });
  const target = await fs.mkdtemp(path.join(root, "directory-adapter-"));
  t.after(async () => {
    if (path.dirname(path.resolve(target)) !== root) throw new Error("cleanup escaped staging directory");
    await fs.rm(target, { recursive: true, force: true });
  });
  return target;
}

test("directory adapter lists only direct entries including hidden files without changing cwd", async (t) => {
  const target = await directory(t);
  await fs.mkdir(path.join(target, "sub"));
  await fs.writeFile(path.join(target, "sub/nested.svg"), "nested");
  await fs.writeFile(path.join(target, "demo.svg"), "svg");
  await fs.writeFile(path.join(target, ".hidden"), "hidden");
  const original = process.cwd();
  const adapter = new NodeDirectoryAdapter(() => target);
  assert.equal(adapter.getCurrentDirectory(), target);
  assert.deepEqual([...(await adapter.readDirectory(target))].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0), [
    { name: ".hidden", kind: "file" }, { name: "demo.svg", kind: "file" }, { name: "sub", kind: "directory" },
  ]);
  assert.equal(process.cwd(), original);
});

test("empty directories return an empty collection", async (t) => {
  assert.deepEqual(await new NodeDirectoryAdapter().readDirectory(await directory(t)), []);
});

test("missing directories and file paths use the required error while the adapter remains usable", async (t) => {
  const target = await directory(t);
  const file = path.join(target, "plain.txt");
  await fs.writeFile(file, "text");
  const adapter = new NodeDirectoryAdapter();
  for (const invalid of [path.join(target, "missing"), file]) {
    await assert.rejects(adapter.readDirectory(invalid), { message: `cannot read directory: ${invalid}` });
  }
  assert.equal((await adapter.readDirectory(target)).length, 1);
  assert.equal(adapter.getCurrentDirectory(), process.cwd());
});
