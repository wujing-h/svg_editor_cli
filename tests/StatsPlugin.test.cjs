// 用途：验证 stats 实际包的两种装配、启用禁用、复合统计及文档和历史不变。
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { EditorBootstrap } = require("../dist/bootstrap/EditorBootstrap.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { ProtectedGroup } = require("./helpers/ProtectedGroup.cjs");
const pluginFixture = require("./helpers/pluginFixture.cjs");

const packagePath = path.resolve(__dirname, "../plugins/plugin-stats");
const main = path.resolve(__dirname, "../dist/main.js");

async function editor(t) {
  const fixture = await pluginFixture(t);
  const errors = [];
  const app = new EditorBootstrap((error) => errors.push(error.message));
  t.after(() => app.dispose());
  await app.loader.loadConfig(await fixture.config([{ module: packagePath }]));
  assert.deepEqual(errors, []);
  const dispatcher = new CommandDispatcher(app.session, app.plugins.commands);
  const parser = new CommandLineParser();
  return { app, run: async (line) => app.formatter.format(await dispatcher.dispatch(parser.parse(line))) };
}

function launch(cwd, args, input) {
  const result = spawnSync(process.execPath, [main, ...args], { cwd, input, encoding: "utf8", timeout: 5000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

test("stats appears in help, requires a document and accepts no arguments", async (t) => {
  const { run } = await editor(t);
  assert.ok((await run("help")).some((line) => /^stats\s+count leaf shapes/.test(line)));
  await assert.rejects(run("stats"), /no document/);
  await run("init");
  assert.deepEqual(await run("stats"), ["(total 0, containers 0)"]);
  await assert.rejects(run("stats extra"), /usage: stats/);
  await assert.rejects(run("undo"), /undo not allowed after io command/);
});

test("nested builtins and a generic composite follow DFS order and do not count containers as leaves", async (t) => {
  const { app, run } = await editor(t);
  for (const line of ["init", "create g scene", 'create text t 1 2 "title" in scene', "create circle c 1 2 3 in scene"]) await run(line);
  app.session.requireDocument().insert(new ProtectedGroup("panel"), "scene");
  await run("create rect last 1 2 3 4");
  assert.deepEqual(await run("stats"), ["text: 2  circle: 1  rect: 2  (total 5, containers 2)"]);
  const before = app.session.getSnapshot();
  await run("stats");
  assert.deepEqual(app.session.getSnapshot(), before);
});

test("successful and failed stats queries leave edit history and session events unchanged", async (t) => {
  const { app, run } = await editor(t);
  await run("init");
  await run("create rect r 1 2 3 4");
  await run("move r 10 20");
  await run("undo");
  const before = app.session.getSnapshot();
  const events = [];
  const subscription = app.session.onDidChange((event) => events.push(event));
  await run("stats");
  await assert.rejects(run("stats extra"), /usage: stats/);
  assert.deepEqual(app.session.getSnapshot(), before);
  assert.deepEqual(events, []);
  await run("redo");
  assert.equal(app.session.requireDocument().findShape("r").describe().geometry.x, 11);
  await run("stats");
  await run("undo");
  assert.deepEqual(app.session.getSnapshot(), before);
  subscription.dispose();
});

test("the real package has byte-identical code/config output and explicit disabled configuration removes it", async (t) => {
  const fixture = await pluginFixture(t);
  const config = await fixture.config([{ module: packagePath }]);
  const disabled = await fixture.config([{ module: packagePath, enabled: false }], "disabled.json");
  const input = 'stats\nhelp\ninit\ncreate g scene\ncreate text t 1 2 "title" in scene\ncreate rect r 1 2 3 4 in scene\nstats\nmove r 10 20\nundo\nstats\nredo\ntree\nstats\n';
  const codeOutput = launch(fixture.root, [], input);
  assert.equal(launch(fixture.root, ["--config", config], input), codeOutput);
  assert.match(codeOutput, /text: 1  rect: 1  \(total 2, containers 1\)/);
  const disabledOutput = launch(fixture.root, ["--config", disabled], "help\ninit\nstats\n");
  assert.match(disabledOutput, /error: unknown command: stats/);
  assert.doesNotMatch(disabledOutput, /^stats\s+count leaf shapes/m);
});

test("A and B retain the same registration rejection and preserve already loaded commands", async (t) => {
  const { app, run } = await editor(t);
  const plugin = require(packagePath).default;
  const manifest = require(path.join(packagePath, "package.json"));
  const errors = [];
  const { PluginLoader } = require("../dist/bootstrap/PluginLoader.js");
  const loader = new PluginLoader(app.plugins, (error) => errors.push(error.message));
  assert.equal(loader.activate(manifest, plugin), false);
  assert.deepEqual(errors, ["duplicate registration: commands/stats"]);
  await run("init");
  assert.deepEqual(await run("stats"), ["(total 0, containers 0)"]);
});
