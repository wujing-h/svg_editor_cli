// 用途：仅用公开查询与注册替身，独立验证统计命令和插件契约，不依赖宿主或其他插件。
const assert = require("node:assert/strict");
const test = require("node:test");
const { StatsCommand, StatsPlugin } = require("../dist/index.js");
const manifest = require("../package.json");

const leaf = (kind, id = kind, type) => ({ id, kind, attributes: {}, ...(type === undefined ? {} : { type }) });
const group = (id, children = [], type) => ({ ...leaf("g", id, type), children });
const snapshot = (roots) => ({ canvas: { width: 800, height: 600 }, roots });
const execute = (roots) => new StatsCommand({ getSnapshot: () => snapshot(roots) }, []).execute().lines;

test("empty canvas and empty containers have no leaves and the SVG root is never counted", () => {
  assert.deepEqual(execute([]), ["(total 0, containers 0)"]);
  assert.deepEqual(execute([group("one", [group("two")])]), ["(total 0, containers 2)"]);
});

test("leaf types follow first depth-first appearance rather than alphabetical or sibling-only order", () => {
  const roots = [group("scene", [leaf("text"), group("inner", [leaf("rect", "r1"), leaf("circle")]), leaf("text", "t2")]),
    leaf("rect", "r2"), leaf("line")];
  assert.deepEqual(execute(roots), ["text: 2  rect: 2  circle: 1  line: 1  (total 6, containers 2)"]);
});

test("the assignment's example uses double spaces between counts and before totals", () => {
  assert.deepEqual(execute([group("a", [leaf("rect", "r1"), leaf("circle"), leaf("text", "t1")]),
    group("b", [leaf("rect", "r2"), leaf("rect", "r3"), leaf("text", "t2")])]),
  ["rect: 3  circle: 1  text: 2  (total 6, containers 2)"]);
});

test("composite containers are detected structurally and their internal leaves still count", () => {
  assert.deepEqual(execute([group("composite", [leaf("rect"), group("nested", [leaf("text")], "custom-container")], "other-container"),
    leaf("rect", "special", "custom-leaf")]), ["rect: 1  text: 1  custom-leaf: 1  (total 3, containers 2)"]);
});

test("repeated execution queries fresh content and does not mutate its input", () => {
  let current = snapshot([group("scene", [leaf("rect")])]);
  const before = structuredClone(current);
  const command = new StatsCommand({ getSnapshot: () => current }, []);
  assert.deepEqual(command.execute().lines, ["rect: 1  (total 1, containers 1)"]);
  assert.deepEqual(current, before);
  current = snapshot([leaf("text")]);
  assert.deepEqual(command.execute().lines, ["text: 1  (total 1, containers 0)"]);
});

test("missing documents and extra parameters report clear errors without performing work", () => {
  assert.throws(() => new StatsCommand({ getSnapshot: () => undefined }, []).execute(), /no document\. use 'init' or 'read' first/);
  assert.throws(() => new StatsCommand({ getSnapshot: () => assert.fail("must validate arguments first") }, [{ value: "extra", quoted: false }]).execute(), /usage: stats/);
});

test("the plugin registers metadata matching its package manifest and creates independent command objects", () => {
  let definition;
  const plugin = new StatsPlugin();
  plugin.activate({ services: { editor: { getSnapshot: () => snapshot([]) } }, registerCommand: (entry) => { definition = entry; } });
  assert.deepEqual(manifest.contributes.commands, [definition.name]);
  assert.equal(definition.syntax, "stats");
  assert.match(definition.description, /count leaf shapes/);
  assert.notEqual(definition.create([]), definition.create([]));
  assert.deepEqual(definition.create([]).execute().lines, ["(total 0, containers 0)"]);
});

test("unsupported plugin options fail before any registration", () => {
  const plugin = new StatsPlugin();
  assert.throws(() => plugin.activate({ registerCommand: () => assert.fail("must not register") }, {}), /stats plugin does not accept options/);
});
