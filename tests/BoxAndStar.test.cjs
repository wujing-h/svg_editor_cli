// 用途：验证真实 box/星号插件的结构、历史、SVG 读回及独立组合；最终交付验收另行进行。
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { EditorBootstrap } = require("../dist/bootstrap/EditorBootstrap.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const pluginFixture = require("./helpers/pluginFixture.cjs");

async function editor(t, packages = ["plugin-stats", "plugin-shape-box", "plugin-tree-star"]) {
  const fixture = await pluginFixture(t);
  const errors = [];
  const app = new EditorBootstrap((error) => errors.push(error.message));
  t.after(() => app.dispose());
  const config = await fixture.config(packages.map((name) => ({ module: path.resolve(__dirname, "../plugins", name) })));
  await app.loader.loadConfig(config);
  assert.deepEqual(errors, []);
  const dispatcher = new CommandDispatcher(app.session, app.plugins.commands);
  const parser = new CommandLineParser();
  const run = async (line) => app.formatter.format(await dispatcher.dispatch(parser.parse(line)));
  const file = (name) => path.join(fixture.root, name);
  return { app, run, file, errors, config, root: fixture.root,
    save: (name = "scene.svg") => run(`save "${file(name)}"`), read: (name = "scene.svg") => run(`read "${file(name)}"`) };
}
const clean = (lines) => assert.ok(lines.every((line) => !line.endsWith(" *")), lines.join("\n"));
const row = (lines, id) => lines.find((line) => line.includes(`#${id} `) || line.endsWith(`#${id}`));

test("create box builds both children in one history unit and labels compose in the declared order", async (t) => {
  const { app, run } = await editor(t);
  await run("init");
  assert.deepEqual(await run("tree"), ["svg (800x600)"]);
  assert.deepEqual(await run('create box b 120 100 160 60 "开始"'), ["box#b created"]);
  const box = app.session.requireDocument().findShape("b");
  const body = app.session.requireDocument().findShape("b-rect");
  assert.equal(box.children[0], body);
  assert.equal((await run("tree b"))[0], "g#b (box) *");
  assert.deepEqual(await run("stats"), ["rect: 1  text: 1  (total 2, containers 1)"]);
  await run("undo");
  assert.deepEqual(app.session.requireDocument().getRootShapes(), []);
  await run("redo");
  assert.equal(app.session.requireDocument().findShape("b-rect"), body);
});

test("root or derived ID conflicts reject the whole create while preserving redo", async (t) => {
  for (const id of ["b", "b-rect", "b-label"]) {
    const { app, run } = await editor(t);
    await run("init");
    await run(`create rect ${id} 1 2 3 4`);
    await run(`move ${id} 10 20`);
    await run("undo");
    const before = app.session.getSnapshot();
    await assert.rejects(run('create box b 1 2 3 4 "x"'), /id already exists/);
    assert.deepEqual(app.session.getSnapshot(), before);
    await run("redo");
    assert.equal(app.session.requireDocument().findShape(id).describe().geometry.x, 11);
  }
});

test("necessary components cannot be removed, grouped away or reparented; failed edits keep redo", async (t) => {
  const { app, run } = await editor(t);
  for (const line of ["init", "create g scene", 'create box b 1 2 3 4 "x" in scene', "create g other", "move b 10 20", "undo"]) await run(line);
  const before = app.session.getSnapshot();
  for (const line of ["delete b-rect", "delete b-label", "addto other b-rect", "group moved b-label"]) {
    await assert.rejects(run(line), /required component must remain/);
    assert.deepEqual(app.session.getSnapshot(), before);
  }
  await assert.rejects(run("ungroup b"), /cannot ungroup composite shape: b/);
  await run("redo");
  assert.equal(app.session.requireDocument().findShape("b-rect").describe().geometry.x, 11);
});

test("nested boxes permit extras and whole-object grouping, movement, scaling and delete restoration", async (t) => {
  const { app, run, save } = await editor(t);
  for (const line of ["init", "create g scene", 'create box outer 1 2 30 40 "outer" in scene',
    'create box inner 5 6 7 8 "inner" in outer', "create circle extra 1 2 3 in outer"]) await run(line);
  await save();
  const document = app.session.requireDocument();
  const box = document.findShape("outer");
  const innerRect = document.findShape("inner-rect");
  const before = app.session.getSnapshot();
  for (const command of ["move outer 10 20", "scale outer 2", "delete outer", "group wrapper outer"]) {
    await run(command);
    await run("undo");
    assert.deepEqual(app.session.getSnapshot(), before);
    assert.equal(document.findShape("outer"), box);
    assert.equal(document.findShape("inner-rect"), innerRect);
    clean(await run("tree"));
  }
});

test("fill and label use part attributes as single undo units and saved-content stars clear on undo", async (t) => {
  const { app, run, save } = await editor(t);
  await run("init");
  await run('create box b 1 2 30 40 "old"');
  await save();
  const document = app.session.requireDocument();
  await run("set b fill red");
  assert.equal(document.findShape("b").describe().attributes.fill, undefined);
  assert.equal(document.findShape("b-rect").describe().attributes.fill, "red");
  let lines = await run("tree");
  assert.ok(row(lines, "b").endsWith("(box) *"));
  assert.ok(row(lines, "b-rect").endsWith(" *"));
  assert.ok(!row(lines, "b-label").endsWith(" *"));
  await run("undo");
  clean(await run("tree"));
  await run('set b label "新标题"');
  assert.equal(document.findShape("b-label").describe().text, "新标题");
  await run("undo");
  assert.equal(document.findShape("b-label").describe().text, "old");
  clean(await run("tree"));
  await run("redo");
  assert.equal(document.findShape("b-label").describe().text, "新标题");
  await save();
  clean(await run("tree"));
});

test("native SVG round trips preserve composite types and disabled box degrades to ordinary g", async (t) => {
  const app = await editor(t);
  await app.run("init");
  await app.run('create box b 120 100 160 60 "loaded"');
  await app.run("set b fill orange");
  await app.save();
  const before = app.app.session.getSnapshot();
  const content = await fs.readFile(app.file("scene.svg"), "utf8");
  assert.match(content, /<g id="b" data-kind="box">/);
  assert.doesNotMatch(content, /<box/);
  await app.read();
  assert.deepEqual(app.app.session.getSnapshot(), before);
  clean(await app.run("tree"));
  assert.equal(app.app.session.requireDocument().findShape("b").type, "box");
  const disabled = await editor(t, ["plugin-tree-star"]);
  await fs.writeFile(disabled.file("scene.svg"), content, "utf8");
  await disabled.read();
  const plain = disabled.app.session.requireDocument().findShape("b");
  assert.equal(plain.type, "g");
  assert.equal(plain.describe().attributes["data-kind"], "box");
  assert.doesNotMatch((await disabled.run("tree")).join("\n"), /\(box\)/);
  await disabled.run("delete b-rect"); // 降级后没有复合部件保护。
  await disabled.save("broken.svg");
  await fs.writeFile(app.file("broken.svg"), await fs.readFile(disabled.file("broken.svg")));
  const original = app.app.session.requireDocument();
  await assert.rejects(app.read("broken.svg"), /invalid box components/);
  assert.equal(app.app.session.requireDocument(), original);
});

test("malformed loaded boxes reject the whole read and preserve content, stars, association and redo", async (t) => {
  const app = await editor(t);
  await app.run("init");
  await app.run('create box b 1 2 30 40 "valid"');
  await app.save();
  await app.run("move b 10 20");
  await app.run("undo");
  const original = app.app.session.requireDocument();
  const before = app.app.session.getSnapshot();
  for (const contents of ['<g id="bad" data-kind="box"/>', '<g id="bad" data-kind="box"><text id="bad-rect"/><text id="bad-label"/></g>',
    '<g id="bad" data-kind="box"><rect id="same"/><text id="same"/></g>']) {
    await fs.writeFile(app.file("bad.svg"), `<svg width="400" height="300">${contents}</svg>`, "utf8");
    await assert.rejects(app.read("bad.svg"), /invalid box components|id already exists/);
    assert.equal(app.app.session.requireDocument(), original);
    assert.deepEqual(app.app.session.getSnapshot(), before);
    clean(await app.run("tree"));
  }
  await app.run("redo");
  assert.equal(original.findShape("b-rect").describe().geometry.x, 11);
  await app.run("save");
  assert.match(await fs.readFile(app.file("scene.svg"), "utf8"), /x="11"/);
});

test("star resets only after successful IO, while canvas edits and failed save/read keep changes visible", async (t) => {
  const app = await editor(t);
  await app.run("init");
  await app.run("create rect r 1 2 3 4");
  await app.save();
  await app.run("set r fill red");
  const dirty = await app.run("tree");
  await assert.rejects(app.save("missing/fail.svg"), /cannot write file/);
  await assert.rejects(app.read("missing.svg"), /cannot read file/);
  assert.deepEqual(await app.run("tree"), dirty);
  await app.run("undo");
  clean(await app.run("tree"));
  await app.run("canvas 500 400");
  const lines = await app.run("tree");
  assert.equal(lines[0], "svg (500x400) *");
  assert.ok(!row(lines, "r").endsWith(" *"));
  await app.save();
  clean(await app.run("tree"));
  await app.run("move r 0 0"); // 发生了编辑，但内容仍与保存基线相同。
  clean(await app.run("tree"));
});

test("reorder, removal and undo compare structure while queries leave stars and redo untouched", async (t) => {
  const app = await editor(t);
  for (const line of ["init", "create g scene", "create rect a 1 2 3 4 in scene", "create circle b 5 6 7 in scene"]) await app.run(line);
  await app.save();
  await app.run("front a");
  assert.ok(row(await app.run("tree"), "a").endsWith(" *"));
  await app.run("undo");
  const cleanTree = await app.run("tree");
  clean(cleanTree);
  await app.run("stats");
  await app.run("show a");
  await app.run("redo");
  await app.run("undo");
  await app.run("delete b");
  assert.ok(row(await app.run("tree"), "scene").endsWith(" *"));
  await app.run("undo");
  assert.deepEqual(await app.run("tree"), cleanTree);
});

test("box works without star, and two hosts do not share saved-content state", async (t) => {
  const boxOnly = await editor(t, ["plugin-shape-box"]);
  await boxOnly.run("init");
  await boxOnly.run('create box b 1 2 3 4 "title"');
  assert.equal((await boxOnly.run("tree b"))[0], "g#b (box)");
  const first = await editor(t);
  const second = await editor(t);
  for (const app of [first, second]) { await app.run("init"); await app.run("create rect r 1 2 3 4"); await app.save(); }
  await first.run("move r 10 20");
  assert.ok((await first.run("tree"))[0].endsWith(" *"));
  clean(await second.run("tree"));
});

test("the flowchart behavior runs through both installed plugins and saves eight native elements", async (t) => {
  const app = await editor(t);
  for (const line of ["init 800 600", 'create box n1 120 100 160 60 "开始"', 'create box n2 520 100 160 60 "处理数据"',
    "create line arrow1 280 130 520 130 black", "group flowchart n1 n2 arrow1", "move n2 0 100", "undo",
    "set n2 fill #f5a623", 'set n2 label "处理数据 v2"', "undo"]) await app.run(line);
  const saved = await app.save();
  assert.ok(saved[0].endsWith("(8 elements)"));
  assert.equal(app.app.session.requireDocument().findShape("n2-label").describe().text, "处理数据");
  clean(await app.run("tree"));
  assert.equal((await app.run("tree n2"))[0], "g#n2 (box)");
  await app.read();
  assert.deepEqual(await app.run("stats"), ["rect: 2  text: 2  line: 1  (total 5, containers 3)"]);
});

test("all four packages have the same CLI output under code and configuration activation", async (t) => {
  const fixture = await pluginFixture(t);
  const config = await fixture.config(["plugin-stats", "plugin-dir", "plugin-shape-box", "plugin-tree-star"]
    .map((name) => ({ module: path.resolve(__dirname, "../plugins", name) })));
  const input = 'init\ncreate g scene\ncreate box b 1 2 30 40 "title" in scene\nset b label "changed"\ntree\nundo\nstats\ntree\n';
  const launch = (args) => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, "../dist/main.js"), ...args], { cwd: fixture.root, input, encoding: "utf8", timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    return result.stdout;
  };
  const code = launch([]);
  assert.equal(launch(["--config", config]), code);
  assert.match(code, /g#b \(box\) \*/);
});
