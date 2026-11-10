// 用途：验证 dir 与真实适配器组合、查询历史不变，以及固定 cwd 下的代码/配置一致性。
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { BuiltinShapes } = require("../dist/builtins/BuiltinShapes.js");
const { BuiltinCommands } = require("../dist/builtins/BuiltinCommands.js");
const { PluginLoader } = require("../dist/bootstrap/PluginLoader.js");
const { NodeDirectoryAdapter } = require("../dist/infrastructure/NodeDirectoryAdapter.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { createSvgReader } = require("./helpers/shapes.cjs");
const pluginFixture = require("./helpers/pluginFixture.cjs");
const dir = require("../plugins/plugin-dir").default;
const manifest = require("../plugins/plugin-dir/package.json");

const packagePath = path.resolve(__dirname, "../plugins/plugin-dir");
const statsPath = path.resolve(__dirname, "../plugins/plugin-stats");
const main = path.resolve(__dirname, "../dist/main.js");

function editor(t, directory, store) {
  const session = new EditorSession(store);
  const host = new PluginHost({ editor: session, directory });
  t.after(() => host.dispose());
  const shapes = new BuiltinShapes();
  host.activate(shapes.manifest, shapes);
  const commands = new BuiltinCommands(session, new ShapeFactory(host.shapes));
  host.activate(commands.manifest, commands);
  const errors = [];
  new PluginLoader(host, (error) => errors.push(error.message)).activate(manifest, dir);
  assert.deepEqual(errors, []);
  const dispatcher = new CommandDispatcher(session, host.commands);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  return { session, run: async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line))) };
}

async function fixtureDirectory(t) {
  const fixture = await pluginFixture(t);
  const cwd = path.join(fixture.root, "cwd");
  await fs.mkdir(path.join(cwd, "b-dir"), { recursive: true });
  await fs.mkdir(path.join(cwd, "a-dir"));
  for (const name of ["b.svg", "a.txt", ".hidden"]) await fs.writeFile(path.join(cwd, name), "fixture", "utf8");
  await fs.writeFile(path.join(cwd, "a-dir", "nested.txt"), "not a direct entry", "utf8");
  return { ...fixture, cwd };
}

const expected = ["[DIR]  a-dir", "[DIR]  b-dir", "[FILE]  .hidden", "[FILE]  a.txt", "[FILE]  b.svg"];

function launch(cwd, args, input) {
  const result = spawnSync(process.execPath, [main, ...args], { cwd, input, encoding: "utf8", timeout: 5000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

test("the real adapter lists hidden and direct entries without initialization, recursion or cwd changes", async (t) => {
  const fixture = await fixtureDirectory(t);
  const beforeCwd = process.cwd();
  const { session, run } = editor(t, new NodeDirectoryAdapter(() => fixture.cwd));
  assert.deepEqual(await run("dir"), expected);
  assert.equal(session.getSnapshot(), undefined);
  assert.equal(process.cwd(), beforeCwd);
  assert.ok((await run("help")).some((line) => /^dir\s+list direct entries/.test(line)));
  await assert.rejects(run("dir extra"), /usage: dir/);
  await assert.rejects(run("undo"), /no document/);
});

test("empty real directories produce the specified message", async (t) => {
  const fixture = await pluginFixture(t);
  const empty = path.join(fixture.root, "empty");
  await fs.mkdir(empty);
  const { run } = editor(t, new NodeDirectoryAdapter(() => empty));
  assert.deepEqual(await run("dir"), ["(empty directory)"]);
});

test("real directory success and read failure preserve document, redo, events and process cwd", async (t) => {
  const fixture = await fixtureDirectory(t);
  let selected = fixture.cwd;
  const beforeCwd = process.cwd();
  const { session, run } = editor(t, new NodeDirectoryAdapter(() => selected));
  for (const line of ["init", "create rect r 1 2 3 4", "move r 10 20", "undo"]) await run(line);
  const before = session.getSnapshot();
  const events = [];
  const subscription = session.onDidChange((event) => events.push(event));
  assert.deepEqual(await run("dir"), expected);
  selected = path.join(fixture.root, "missing");
  await assert.rejects(run("dir"), { message: `cannot read directory: ${selected}` });
  await assert.rejects(run("dir extra"), /usage: dir/);
  assert.deepEqual(session.getSnapshot(), before);
  assert.deepEqual(events, []);
  assert.equal(process.cwd(), beforeCwd);
  await run("redo");
  assert.equal(session.requireDocument().findShape("r").describe().geometry.x, 11);
  selected = fixture.cwd;
  await run("dir");
  await run("undo");
  assert.deepEqual(session.getSnapshot(), before);
  subscription.dispose();
});

test("read/save association and IO history restrictions survive directory queries", async (t) => {
  const fixture = await fixtureDirectory(t);
  const saved = [];
  const { session, run } = editor(t, new NodeDirectoryAdapter(() => fixture.cwd), {
    read: async () => createSvgReader().parse('<svg width="400" height="300"><rect id="r" width="1" height="2"/></svg>'),
    save: async (_document, target) => { saved.push(target); return 1; },
  });
  const source = path.join(fixture.root, "elsewhere", "source.svg");
  await run(`read "${source}"`);
  const before = session.getSnapshot();
  assert.deepEqual(await run("dir"), expected);
  await assert.rejects(run("undo"), /undo not allowed after io command/);
  await run("save");
  assert.deepEqual(saved, [source]);
  await run("dir");
  await assert.rejects(run("undo"), /undo not allowed after io command/);
  assert.deepEqual(session.getSnapshot(), before);
});

test("fixed-directory code/config sessions including real read/save have byte-identical output", async (t) => {
  const fixture = await fixtureDirectory(t);
  // 配置、源 SVG 和保存目标都放在 cwd 外，避免自身改变被比较的目录列表。
  const config = await fixture.config([{ module: statsPath }, { module: packagePath }]);
  const source = path.join(fixture.root, "source.svg");
  const saved = path.join(fixture.root, "saved.svg");
  await fs.writeFile(source, '<svg width="400" height="300"><rect id="r" width="1" height="2"/></svg>', "utf8");
  const input = `dir\nhelp\nread "${source}"\ndir\nmove r 10 20\nundo\ndir\nredo\nsave "${saved}"\ndir\nstats\n`;
  const beforeEntries = (await fs.readdir(fixture.cwd)).sort();
  const codeOutput = launch(fixture.cwd, [], input);
  const configOutput = launch(fixture.cwd, ["--config", config], input);
  assert.equal(configOutput, codeOutput);
  const directoryLines = codeOutput.split("\n").filter((line) => /^\[(DIR|FILE)\]/.test(line));
  assert.deepEqual(directoryLines, [...expected, ...expected, ...expected, ...expected]);
  assert.deepEqual((await fs.readdir(fixture.cwd)).sort(), beforeEntries);
});

test("config can enable dir alone or disable it independently of stats", async (t) => {
  const fixture = await fixtureDirectory(t);
  const onlyDir = await fixture.config([{ module: packagePath }], "dir-only.json");
  const enabled = launch(fixture.cwd, ["--config", onlyDir], "dir\nhelp\nstats\n");
  assert.match(enabled, /\[DIR\]  a-dir/);
  assert.match(enabled, /error: unknown command: stats/);
  const disabled = await fixture.config([{ module: statsPath }, { module: packagePath, enabled: false }], "disabled.json");
  const output = launch(fixture.cwd, ["--config", disabled], "dir\nhelp\ninit\nstats\n");
  assert.match(output, /error: unknown command: dir/);
  assert.doesNotMatch(output, /^dir\s+list direct entries/m);
  assert.match(output, /\(total 0, containers 0\)/);
});
