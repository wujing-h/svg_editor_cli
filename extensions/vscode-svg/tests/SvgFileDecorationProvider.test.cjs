// 用途：独立验证 SVG 文件标记的类型判断、取消及查询失败，不依赖 VSCode 运行时。
const assert = require("node:assert/strict");
const test = require("node:test");
const { SvgFileDecorationProvider } = require("../dist/SvgFileDecorationProvider.js");

test("SVG files receive display metadata without modifying their URI", async () => {
  const uri = Object.freeze({ path: "/fixtures/example.svg" });
  const provider = new SvgFileDecorationProvider(async (queried) => {
    assert.equal(queried, uri);
    return true;
  });

  assert.deepEqual(await provider.provideFileDecoration(uri, { isCancellationRequested: false }), {
    badge: "[]", tooltip: "SVG file", propagate: false,
  });
});

test("uppercase SVG suffixes and Unicode names are supported", async () => {
  const provider = new SvgFileDecorationProvider(async () => true);
  const decoration = await provider.provideFileDecoration(
    { path: "/fixtures/流程图.SVG" }, { isCancellationRequested: false },
  );
  assert.equal(decoration.badge, "[]");
});

test("non-SVG paths are ignored before querying the file system", async () => {
  let queries = 0;
  const provider = new SvgFileDecorationProvider(async () => { queries += 1; return true; });
  for (const path of ["/plain.txt", "/example.svg.txt", "/folder.svg/plain.txt", "/folder/"]) {
    assert.equal(await provider.provideFileDecoration({ path }, { isCancellationRequested: false }), undefined);
  }
  assert.equal(queries, 0);
});

test("a directory named with an SVG suffix receives no decoration", async () => {
  const provider = new SvgFileDecorationProvider(async () => false);
  assert.equal(await provider.provideFileDecoration(
    { path: "/fixtures/folder.svg" }, { isCancellationRequested: false },
  ), undefined);
});

test("a missing or unreadable SVG does not reject the decoration request", async () => {
  const provider = new SvgFileDecorationProvider(async () => { throw new Error("file unavailable"); });
  assert.equal(await provider.provideFileDecoration(
    { path: "/fixtures/missing.svg" }, { isCancellationRequested: false },
  ), undefined);
});

test("an already cancelled request performs no file query", async () => {
  let queries = 0;
  const provider = new SvgFileDecorationProvider(async () => { queries += 1; return true; });
  assert.equal(await provider.provideFileDecoration(
    { path: "/fixtures/example.svg" }, { isCancellationRequested: true },
  ), undefined);
  assert.equal(queries, 0);
});

test("cancellation during a pending file query suppresses the decoration", async () => {
  const token = { isCancellationRequested: false };
  let complete;
  const provider = new SvgFileDecorationProvider(() => new Promise((resolve) => { complete = resolve; }));
  const pending = provider.provideFileDecoration({ path: "/fixtures/example.svg" }, token);
  token.isCancellationRequested = true;
  complete(true);
  assert.equal(await pending, undefined);
});
