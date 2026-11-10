// 用途：验证真实模块解析、两种装配一致性、规定加载错误及配置失败原子性。
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { EditorBootstrap } = require("../dist/bootstrap/EditorBootstrap.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const pluginFixture = require("./helpers/pluginFixture.cjs");

function editor(t, report) {
  const errors = [];
  const app = new EditorBootstrap((error) => { errors.push(error.message); if (report) report(error); });
  t.after(() => app.dispose());
  const dispatcher = new CommandDispatcher(app.session, app.plugins.commands);
  const parser = new CommandLineParser();
  return { app, errors, run: async (line) => app.formatter.format(await dispatcher.dispatch(parser.parse(line))) };
}

const commandSource = (name, text = name) => `module.exports = { activate(ctx, options) {
  ctx.registerCommand({ name: ${JSON.stringify(name)}, syntax: ${JSON.stringify(name)}, description: "test command",
    create: () => ({ execute: () => ({ lines: [${JSON.stringify(text)}, JSON.stringify(options ?? null)] }) }) });
} };`;

test("relative packages use the configuration directory, loading order and original options", async (t) => {
  const fixture = await pluginFixture(t);
  for (const name of ["first", "second"]) await fixture.plugin(`settings/${name}`, { name, contributes: { commands: [name] } }, commandSource(name));
  const config = await fixture.config([{ module: "./first", options: { nested: { flag: true }, color: "#fff" } }, { module: "./second", options: [1, "two"] }], "settings/list.json");
  const { app, errors, run } = editor(t);
  await app.loader.loadConfig(config);
  assert.deepEqual(errors, []);
  assert.deepEqual(app.plugins.commands.getAll().slice(-2).map((item) => item.name), ["first", "second"]);
  assert.deepEqual(await run("first"), ["first", '{"nested":{"flag":true},"color":"#fff"}']);
  assert.deepEqual(await run("second"), ["second", '[1,"two"]']);
});

test("disabled entries are not resolved or evaluated and later entries still load", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("disabled", { name: "disabled" }, 'throw new Error("must never evaluate");');
  await fixture.plugin("good", { name: "good", contributes: { commands: ["good"] } }, commandSource("good"));
  const config = await fixture.config([{ module: "./missing", enabled: false }, { module: "./disabled", enabled: false }, { module: "./good" }]);
  const { app, errors, run } = editor(t);
  await app.loader.loadConfig(config);
  assert.deepEqual(errors, []);
  assert.deepEqual(await run("good"), ["good", "null"]);
});

test("package names and exported entries resolve from config-local node_modules even when package.json is not exported", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("settings/node_modules/@fixture/command", { name: "@fixture/command", exports: { ".": "./index.cjs" }, contributes: { commands: ["named"] } }, commandSource("named"));
  const config = await fixture.config([{ module: "@fixture/command" }], "settings/list.json");
  const { app, errors, run } = editor(t);
  await app.loader.loadConfig(config);
  assert.deepEqual(errors, []);
  assert.deepEqual(await run("named"), ["named", "null"]);
});

test("native ESM, TS CommonJS defaults and native CommonJS defaults can all activate", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("esm", { name: "esm", type: "module", contributes: { commands: ["esm"] } }, commandSource("esm").replace("module.exports =", "export default"), "index.mjs");
  await fixture.plugin("compiled", { name: "compiled", contributes: { commands: ["compiled"] } }, 'Object.defineProperty(exports, "__esModule", { value: true });\n' + commandSource("compiled").replace("module.exports =", "exports.default ="));
  await fixture.plugin("native 中文 #", { name: "native", contributes: { commands: ["native"] } }, commandSource("native"));
  const config = await fixture.config([{ module: "./esm" }, { module: "./compiled" }, { module: "./native 中文 #" }]);
  const { app, errors, run } = editor(t);
  await app.loader.loadConfig(config);
  assert.deepEqual(errors, []);
  for (const name of ["esm", "compiled", "native"]) assert.deepEqual(await run(name), [name, "null"]);
});

test("the four required failures report their own categories and continue with later plugins", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("named-only", { name: "named-only", type: "module" }, "export const named = {};", "index.mjs");
  await fixture.plugin("mismatch", { name: "mismatch", contributes: { commands: ["expected"] } }, commandSource("actual"));
  await fixture.plugin("throws", { name: "throws", contributes: { commands: ["temporary"] } }, commandSource("temporary").replace('} };', 'throw new Error("activation exploded"); } };'));
  await fixture.plugin("good", { name: "good", contributes: { commands: ["good"] } }, commandSource("good"));
  const config = await fixture.config(["missing", "named-only", "mismatch", "throws", "good"].map((name) => ({ module: `./${name}` })));
  const { app, errors, run } = editor(t);
  await app.loader.loadConfig(config);
  assert.equal(errors[0], "plugin not found: ./missing");
  assert.equal(errors[1], "plugin has no default export: ./named-only");
  assert.match(errors[2], /^plugin manifest mismatch: mismatch \(declared: .*commands=\[expected\].*registered: .*commands=\[actual\]/);
  assert.equal(errors[3], "plugin failed to activate: throws (activation exploded)");
  assert.equal(errors.length, 4);
  assert.equal(app.plugins.commands.has("actual"), false);
  assert.equal(app.plugins.commands.has("temporary"), false);
  assert.deepEqual(await run("good"), ["good", "null"]);
});

test("entry evaluation, syntax and dependency errors are not misreported as a missing top-level plugin", async (t) => {
  const fixture = await pluginFixture(t);
  for (const [folder, source, file] of [
    ["cjs-dependency", 'require("definitely-missing-plugin-dependency"); module.exports = {};', "index.cjs"],
    ["esm-dependency", 'import "./missing-dependency.mjs"; export default {};', "index.mjs"],
    ["evaluation", 'throw new Error("evaluation exploded");', "index.cjs"],
    ["syntax", 'module.exports = { activate( {', "index.cjs"],
  ]) await fixture.plugin(folder, { name: folder }, source, file);
  const config = await fixture.config(["cjs-dependency", "esm-dependency", "evaluation", "syntax"].map((name) => ({ module: `./${name}` })));
  const { app, errors } = editor(t);
  await app.loader.loadConfig(config);
  assert.equal(errors.length, 4);
  for (const [index, name] of ["cjs-dependency", "esm-dependency", "evaluation", "syntax"].entries()) {
    assert.ok(errors[index].startsWith(`plugin failed to activate: ${name} (`), errors[index]);
    assert.ok(!errors[index].startsWith("plugin not found:"));
  }
});

test("duplicate registration preserves the first plugin, rolls back the new one and continues", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("first", { name: "first", contributes: { commands: ["shared"] } }, commandSource("shared", "first"));
  await fixture.plugin("duplicate", { name: "duplicate", contributes: { commands: ["new", "shared"] } }, `module.exports = { activate(ctx) {
    ctx.registerCommand({ name: "new", syntax: "new", description: "temporary", create: () => ({execute: () => ({})}) });
    ctx.registerCommand({ name: "shared", syntax: "shared", description: "duplicate", create: () => ({execute: () => ({})}) });
  } };`);
  await fixture.plugin("after", { name: "after", contributes: { commands: ["after"] } }, commandSource("after"));
  const config = await fixture.config(["first", "duplicate", "after"].map((name) => ({ module: `./${name}` })));
  const { app, errors, run } = editor(t);
  await app.loader.loadConfig(config);
  assert.deepEqual(errors, ["duplicate registration: commands/shared"]);
  assert.equal(app.plugins.commands.has("new"), false);
  assert.deepEqual(await run("shared"), ["first", "null"]);
  assert.deepEqual(await run("after"), ["after", "null"]);
});

test("invalid JSON, structure or later entries reject the whole config before any plugin activates", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("good", { name: "good", contributes: { commands: ["good"] } }, commandSource("good"));
  const target = path.join(fixture.root, "bad.json");
  for (const source of ["{", "null", "[]", "{}", '{"plugins":{}}', '{"plugins":[],"other":1}',
    '{"plugins":[{"module":"./good"},{"enabled":false}]}', '{"plugins":[{"module":"./good","enabled":"false"}]}',
    '{"plugins":[{"module":" "}]}', '{"plugins":[{"module":"./good","option":1}]}']) {
    await fs.writeFile(target, source, "utf8");
    const { app, errors } = editor(t);
    await app.loader.loadConfig(target);
    assert.deepEqual(errors, ["invalid plugin config"], source);
    assert.equal(app.plugins.commands.has("good"), false);
    assert.equal(app.plugins.commands.has("help"), true);
  }
  const { app, errors } = editor(t);
  await app.loader.loadConfig(path.join(fixture.root, "absent.json"));
  assert.deepEqual(errors, ["invalid plugin config"]);
});

test("bad default values and malformed manifests fail activation without stopping later loads", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("bad-default", { name: "bad-default", type: "module" }, "export default 42;", "index.mjs");
  await fixture.plugin("bad-instance", { name: "bad-instance" }, "module.exports = {}; ");
  await fixture.plugin("bad-manifest", { name: "bad-manifest", contributes: { commands: "bad" } }, "module.exports = { activate() {} };");
  await fixture.plugin("compiled-named", { name: "compiled-named" }, 'Object.defineProperty(exports, "__esModule", {value:true}); exports.named = {};');
  const config = await fixture.config(["bad-default", "bad-instance", "bad-manifest", "compiled-named"].map((name) => ({ module: `./${name}` })));
  const { app, errors } = editor(t);
  await app.loader.loadConfig(config);
  assert.match(errors[0], /^plugin failed to activate: bad-default/);
  assert.match(errors[1], /^plugin failed to activate: bad-instance/);
  assert.match(errors[2], /^plugin failed to activate: bad-manifest/);
  assert.equal(errors[3], "plugin has no default export: ./compiled-named");
});

test("code and config activation use the same package manifest, options, registry and output", async (t) => {
  const fixture = await pluginFixture(t);
  const manifest = { name: "parity", contributes: { commands: ["parity"] } };
  const directory = await fixture.plugin("parity", manifest, commandSource("parity"));
  const options = { title: "same", count: 3 };
  const code = editor(t);
  const config = editor(t);
  assert.equal(code.app.loader.activate(manifest, require(path.join(directory, "index.cjs")), options), true);
  await config.app.loader.loadConfig(await fixture.config([{ module: "./parity", options }]));
  assert.deepEqual(code.errors, config.errors);
  for (const line of ["init", "create rect r 1 2 3 4", "move r 10 20", "undo", "redo", "parity", "help", "tree"]) {
    assert.deepEqual(await code.run(line), await config.run(line), line);
  }
});

test("an error reporter that throws cannot stop subsequent configured plugins", async (t) => {
  const fixture = await pluginFixture(t);
  await fixture.plugin("good", { name: "good", contributes: { commands: ["good"] } }, commandSource("good"));
  const { app, errors, run } = editor(t, () => { throw new Error("report failed"); });
  await app.loader.loadConfig(await fixture.config([{ module: "./missing" }, { module: "./good" }]));
  assert.deepEqual(errors, ["plugin not found: ./missing"]);
  assert.deepEqual(await run("good"), ["good", "null"]);
});
