// 用途：验证实际 CLI 配置启动和同时贡献四类扩展的插件，检查框架冻结前的完整调用路径。
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { EditorBootstrap } = require("../dist/bootstrap/EditorBootstrap.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const pluginFixture = require("./helpers/pluginFixture.cjs");

const main = path.resolve(__dirname, "../dist/main.js");
const api = path.resolve(__dirname, "../dist/plugin-api/index.js");
const manifest = { name: "test-all-extensions", contributes: {
  shapes: ["probe-group"], commands: ["probe"], decorators: ["probe-tag"], attributes: ["probe-paint"],
} };

function fullPluginSource(failureMarker) {
  return `const api = require(${JSON.stringify(api)});
    class ProbeGroup extends api.GroupShape { get type() { return "probe-group"; } }
    module.exports = { activate(ctx, options) {
      let events = 0;
      ctx.addDisposable(ctx.services.editor.onDidChange(() => { events += 1; }));
      ctx.registerShape({ name: "probe-group",
        create: (id) => new ProbeGroup(id), createFromParameters: (id) => new ProbeGroup(id),
        createFromSvg: (input) => new ProbeGroup(input.id, {fill:input.attributes.fill}, input.children) });
      ctx.registerCommand({ name: "probe", syntax: "probe", description: "all extension points",
        create: () => ({ execute: () => ({lines:[options.label, String(events)]}) }) });
      ctx.registerDecorator({ name: "probe-tag", order: 10,
        getSuffix: ({shape}) => shape?.type === "probe-group" ? "[probe]" : undefined });
      ctx.registerAttributeHandler({ name: "probe-paint",
        handles: (shape, attr) => shape.type === "probe-group" && attr === "tone",
        apply: (context, shape, _attr, value) => context.setAttribute(shape.id, "fill", value) });
      ${failureMarker ? `ctx.addDisposable({dispose:()=>require("node:fs").writeFileSync(${JSON.stringify(failureMarker)}, "released")}); throw new Error("all four failed");` : ""}
    } };`;
}

function editor(t) {
  const errors = [];
  const app = new EditorBootstrap((error) => errors.push(error.message));
  t.after(() => app.dispose());
  const dispatcher = new CommandDispatcher(app.session, app.plugins.commands);
  const parser = new CommandLineParser();
  return { app, errors, run: async (line) => app.formatter.format(await dispatcher.dispatch(parser.parse(line))) };
}

function launch(cwd, args = [], input = "help\ninit\ntree\n") {
  const result = spawnSync(process.execPath, [main, ...args], { cwd, input, encoding: "utf8", timeout: 5000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test("a single loaded plugin reaches all four extension points and code/config sessions match byte for byte", async (t) => {
  const fixture = await pluginFixture(t);
  const directory = await fixture.plugin("all", manifest, fullPluginSource());
  const configPath = await fixture.config([{ module: "./all", options: { label: "loaded" } }]);
  const code = editor(t);
  const config = editor(t);
  const packageManifest = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8"));
  assert.equal(code.app.loader.activate(packageManifest, require(path.join(directory, "index.cjs")), { label: "loaded" }), true);
  await config.app.loader.loadConfig(configPath);
  const svgPath = path.join(fixture.root, "scene.svg");
  const lines = ["init", "probe", "create probe-group p", "create rect r 1 2 3 4 in p", "set p tone red", "undo", "redo", "tree", "show p", `save "${svgPath}"`, `read "${svgPath}"`, "probe", "help", "tree"];
  const outputA = [];
  const outputB = [];
  for (const line of lines) {
    outputA.push(...await code.run(line));
    outputB.push(...await config.run(line));
  }
  assert.equal(outputA.join("\n"), outputB.join("\n"));
  assert.deepEqual(code.errors, []);
  assert.deepEqual(config.errors, []);
  assert.ok(outputA.some((line) => line.endsWith("fill=red [probe]")));
  assert.ok(outputA.includes("probe-group#p created"));
  assert.ok(outputA.includes('probe-group#p updated: tone="red"'));
  assert.equal(config.app.session.requireDocument().findShape("p").type, "probe-group");
  assert.match(await fs.readFile(svgPath, "utf8"), /<g id="p" fill="red" data-kind="probe-group">/);
});

test("configured activation failures roll back all contribution categories and release subscriptions", async (t) => {
  const fixture = await pluginFixture(t);
  const marker = path.join(fixture.root, "released.txt");
  await fixture.plugin("bad", manifest, fullPluginSource(marker));
  const { app, errors, run } = editor(t);
  const before = [app.plugins.shapes, app.plugins.commands, app.plugins.decorators, app.plugins.attributes].map((registry) => registry.getAll());
  await app.loader.loadConfig(await fixture.config([{ module: "./bad", options: { label: "bad" } }]));
  assert.deepEqual(errors, ["plugin failed to activate: test-all-extensions (all four failed)"]);
  assert.equal(await fs.readFile(marker, "utf8"), "released");
  for (const [index, registry] of [app.plugins.shapes, app.plugins.commands, app.plugins.decorators, app.plugins.attributes].entries()) {
    assert.deepEqual(registry.getAll(), before[index]);
  }
  await run("init");
  await run("create rect r 1 2 3 4");
  await assert.rejects(run("probe"), /unknown command: probe/);
});

test("real CLI loads before its first input, reports plugin errors and continues with valid plugins", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("good", { name: "good", contributes: { commands: ["loaded"] } }, `module.exports = {activate(ctx,options) {
    ctx.registerCommand({name:"loaded",syntax:"loaded",description:"config command",create:()=>({execute:()=>({lines:[options.message]})})});
  }};`);
  const config = await fixture.config([{ module: "./missing" }, { module: "./good", options: { message: "from config" } }]);
  const result = launch(fixture.root, ["--config", config], "loaded\ninit\ncreate rect r 1 2 3 4\nshow r\n");
  assert.equal(result.stderr, "error: plugin not found: ./missing\n");
  assert.match(result.stdout, /^svg-editor 0\.1 - type 'help' for commands\nfrom config\n/);
  assert.match(result.stdout, /rect#r  parent=svg/);
});

test("empty configuration keeps the builtin tree undecorated while the default star decorates changed content", async (t) => {
  const fixture = await pluginFixture(t);
  const config = await fixture.config([]);
  const input = 'init 400 300\ncreate g scene\ncreate rect r 1 2 3 4 red in scene\nmove scene 10 20\nundo\nredo\nset r fill blue\nundo\ntree\nshow r\n';
  const defaults = launch(fixture.root, [], input);
  const configured = launch(fixture.root, ["--config", config], input);
  // 标签启用后的差异只能是行尾星号；空配置仍须提供原始内置树输出。
  assert.equal(defaults.stdout.replace(/ \*$/gm, ""), configured.stdout);
  assert.match(defaults.stdout, /^svg \(400x300\) \*$/m);
  assert.match(configured.stdout, /^svg \(400x300\)$/m);
  assert.equal(defaults.stderr, "");
  assert.equal(configured.stderr, "");
});

test("invalid configuration prints the required error and starts with default capabilities", async (t) => {
  const fixture = await pluginFixture(t);
  const config = path.join(fixture.root, "invalid.json");
  await fs.writeFile(config, "{", "utf8");
  const result = launch(fixture.root, ["--config", config], "init\ncreate rect r 1 2 3 4\nshow r\n");
  assert.equal(result.stderr, "error: invalid plugin config\n");
  assert.match(result.stdout, /rect#r created/);
  const missing = launch(fixture.root, ["--config", "absent.json"]);
  assert.equal(missing.stderr, "error: invalid plugin config\n");
});

test("invalid startup arguments explain usage while retaining a usable default REPL", async (t) => {
  const fixture = await pluginFixture(t);
  for (const args of [["--config"], ["--unknown"], ["--config", "a", "b"]]) {
    const result = launch(fixture.root, args, "init\ntree\n");
    assert.equal(result.stderr, "error: usage: svg-editor [--config <file>]\n");
    assert.match(result.stdout, /svg \(800x600\)/);
  }
});
