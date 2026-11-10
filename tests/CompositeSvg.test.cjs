// 用途：验证复合图形的原生 SVG 读写、类型降级、提供者约束及读取失败的会话原子性。
const assert = require("node:assert/strict");
const test = require("node:test");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { GroupShape, RectShape } = require("pj/plugin-api");
const { ShapeRegistry } = require("../dist/application/ShapeRegistry.js");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { BuiltinShapes } = require("../dist/builtins/BuiltinShapes.js");
const { BuiltinCommands } = require("../dist/builtins/BuiltinCommands.js");
const { SvgReader } = require("../dist/infrastructure/SvgReader.js");
const { SvgWriter } = require("../dist/infrastructure/SvgWriter.js");
const { ProtectedGroup } = require("./helpers/ProtectedGroup.cjs");
const { ProtectedShapeProvider } = require("./helpers/ProtectedShapeProvider.cjs");

const svg = (content) => `<svg width="400" height="300">${content}</svg>`;
const panelSvg = (id = "panel", extra = "") => `<g id="${id}" data-kind="protected" fill="orange"><rect id="${id}-body" x="1" y="2" width="30" height="40"/><text id="${id}-caption" x="3" y="4">title</text>${extra}</g>`;
const snapshot = (document) => document.getRootShapes().map((shape) => shape.describe());

function environment(loadPlugin = true, sources = new Map()) {
  const shapes = new ShapeRegistry();
  const factory = new ShapeFactory(shapes);
  const reader = new SvgReader(factory);
  const writer = new SvgWriter();
  const saved = [];
  const session = new EditorSession({
    read: async (path) => reader.parse(sources.get(path)),
    save: async (document, path) => {
      const result = writer.serialize(document);
      saved.push({ path, ...result });
      return result.elementCount;
    },
  });
  const host = new PluginHost({ editor: session, directory: {} }, shapes);
  const builtin = new BuiltinShapes();
  host.activate(builtin.manifest, builtin);
  const provider = new ProtectedShapeProvider();
  if (loadPlugin) host.activate({ name: "test-protected", contributes: { shapes: [provider.name] } }, {
    activate: (context) => context.registerShape(provider),
  });
  const commands = new BuiltinCommands(session, factory);
  host.activate(commands.manifest, commands);
  const dispatcher = new CommandDispatcher(session, host.commands);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  const run = async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line)));
  return { host, factory, reader, writer, provider, session, run, saved };
}

test("logical types use native SVG tags and ordinary types retain their descriptions", () => {
  const app = environment();
  const plain = app.factory.create("g", "plain");
  assert.equal(plain.type, "g");
  assert.deepEqual(plain.describe(), { id: "plain", kind: "g", attributes: {}, children: [] });
  const panel = app.factory.create("protected", "panel", { fill: "orange" });
  assert.equal(panel.type, "protected");
  assert.equal(panel.kind, "g");
  assert.equal(panel.describe().type, "protected");
  assert.equal(panel.describe().attributes["data-kind"], "protected");
  const document = new SvgDocument(400, 300);
  document.insert(panel);
  const saved = app.writer.serialize(document);
  assert.equal(saved.elementCount, 3);
  assert.match(saved.content, /<g id="panel" fill="orange" data-kind="protected">/);
  assert.doesNotMatch(saved.content, /<protected/);
  const loaded = app.reader.parse(saved.content);
  assert.deepEqual(snapshot(loaded.document), snapshot(document));
  assert.equal(app.writer.serialize(loaded.document).content, saved.content);
});

test("providers receive complete detached subtrees and preserve nested identities, order and ownership", () => {
  const app = environment();
  const input = svg(panelSvg("outer", `<g id="extra">${panelSvg("inner")}</g>`));
  const loaded = app.reader.parse(input);
  assert.equal(loaded.elementCount, 7);
  assert.deepEqual(loaded.warnings, []);
  assert.deepEqual(app.provider.inputs.map((input) => input.id), ["inner", "outer"]);
  const outer = loaded.document.findShape("outer");
  const inner = loaded.document.findShape("inner");
  assert.ok(outer instanceof ProtectedGroup);
  assert.ok(inner instanceof ProtectedGroup);
  assert.deepEqual(outer.children.map((shape) => shape.id), ["outer-body", "outer-caption", "extra"]);
  assert.equal(outer.children[2].children[0], inner);
  assert.equal(inner.parent, loaded.document.findShape("extra"));
  assert.equal(inner.document, loaded.document);
  assert.equal(app.provider.inputs[1].children[0], loaded.document.findShape("outer-body"));
  assert.throws(() => loaded.document.remove("inner-body"), /required component/);
});

test("missing plugins downgrade marked containers without losing metadata or their hierarchy", () => {
  const app = environment(false);
  const loaded = app.reader.parse(svg(panelSvg("panel", '<g id="future" data-kind="future&amp;type"><circle id="c" r="5"/></g>')));
  const panel = loaded.document.findShape("panel");
  assert.equal(panel.constructor, GroupShape);
  assert.equal(panel.type, "g");
  assert.equal(panel.describe().type, undefined);
  assert.equal(panel.describe().attributes["data-kind"], "protected");
  assert.equal(loaded.document.findShape("future").describe().attributes["data-kind"], "future&type");
  const saved = app.writer.serialize(loaded.document);
  assert.deepEqual(snapshot(app.reader.parse(saved.content).document), snapshot(loaded.document));
  const enabled = environment();
  assert.ok(enabled.reader.parse(saved.content).document.findShape("panel") instanceof ProtectedGroup);
  // 降级后是普通组，不能仅凭残留标记获得复合部件保护。
  loaded.document.remove("panel-body");
  assert.throws(() => enabled.reader.parse(app.writer.serialize(loaded.document).content), /required component/);
});

test("marked groups with absent, empty or unknown metadata round trip with ordinary semantics", () => {
  const app = environment(false);
  for (const marker of ["", "g", "unregistered"]) {
    const loaded = app.reader.parse(svg(`<g id="plain" data-kind="${marker}"/>`));
    assert.equal(loaded.document.findShape("plain").type, "g");
    assert.equal(loaded.document.findShape("plain").describe().attributes["data-kind"], marker);
    const saved = app.writer.serialize(loaded.document);
    assert.deepEqual(snapshot(app.reader.parse(saved.content).document), snapshot(loaded.document));
  }
});

test("loaded providers reject incomplete or malformed composites instead of silently downgrading", () => {
  const app = environment();
  for (const content of [
    '<g id="panel" data-kind="protected"/>',
    '<g id="panel" data-kind="protected"><rect id="panel-body"/></g>',
    '<g id="panel" data-kind="protected"><circle id="panel-body"/><text id="panel-caption"/></g>',
    '<rect id="panel" data-kind="protected"/>',
    '<g id="panel" data-kind="protected" transform="translate(1,2)"><rect id="panel-body"/><text id="panel-caption"/></g>',
    panelSvg().replace('id="panel-caption"', 'id="panel-body"'),
    panelSvg().replace('>title</text>', '>title</text>unexpected'),
  ]) assert.throws(() => app.reader.parse(svg(content)), undefined, content);
  assert.ok(app.reader.parse(svg(panelSvg())).document.findShape("panel") instanceof ProtectedGroup);
  // 未知标记不放宽普通 SVG 的属性、元素和命名空间限制。
  const disabled = environment(false);
  for (const content of ['<g id="g" data-kind="future" transform="scale(2)"/>', '<rect data-kind="future"/>',
    '<path data-kind="future"/>', '<g data-kind="rect"/>']) {
    assert.throws(() => disabled.reader.parse(svg(content)), undefined, content);
  }
});

test("SVG providers cannot drop, replace, reorder or synthesize child nodes", () => {
  for (const rebuild of [
    (input) => new GroupShape(input.id),
    (input) => new GroupShape(input.id, {}, input.children.map((child) => new RectShape(child.id, 0, 0, 1, 1))),
    (input) => new GroupShape(input.id, {}, [...input.children].reverse()),
    (input) => new GroupShape(input.id, {}, [...input.children, new GroupShape("invented")]),
  ]) {
    const app = environment(false);
    // 直接注册普通测试类型，检验完整子树协议，无需引入特定复合业务。
    app.host.activate({ name: "test-group-plugin", contributes: { shapes: ["test-group"] } }, {
      activate: (context) => context.registerShape({ name: "test-group", create: () => {}, createFromParameters: () => {}, createFromSvg: rebuild }),
    });
    assert.throws(() => app.reader.parse(svg('<test-group id="g"><rect id="a"/><rect id="b"/></test-group>')), /invalid SVG subtree implementation/);
  }
});

test("metadata-based provider selection rejects a wrong logical type or native tag", () => {
  for (const rebuild of [
    (input) => new GroupShape(input.id),
    (input) => new RectShape(input.id, 0, 0, 1, 1),
  ]) {
    const app = environment(false);
    app.host.activate({ name: "broken-plugin", contributes: { shapes: ["broken"] } }, {
      activate: (context) => context.registerShape({ name: "broken", create: () => {}, createFromParameters: () => {}, createFromSvg: rebuild }),
    });
    assert.throws(() => app.reader.parse(svg('<g id="g" data-kind="broken"/>')), /invalid SVG shape implementation/);
  }
  assert.throws(() => environment().factory.createFromSvg("g", "g", { "data-kind": 42 }, ""), /invalid SVG data-kind/);
});

test("failed composite reads preserve the current tree, association and redo", async () => {
  const sources = new Map([["valid.svg", svg(panelSvg())], ["broken.svg", svg('<g id="invalid" data-kind="protected"><rect/></g>')]]);
  const app = environment(true, sources);
  await app.run("read valid.svg");
  const document = app.session.requireDocument();
  await app.run("move panel 10 20");
  await app.run("undo");
  const before = snapshot(document);
  await assert.rejects(app.run("read broken.svg"), /required component/);
  assert.equal(app.session.requireDocument(), document);
  assert.deepEqual(snapshot(document), before);
  await app.run("redo");
  assert.equal(document.findShape("panel-body").describe().geometry.x, 11);
  await app.run("save");
  assert.equal(app.saved[0].path, "valid.svg");
});

test("CLI feedback uses logical types while tree and show keep native labels", async () => {
  const app = environment();
  await app.run("init");
  assert.deepEqual(await app.run("create protected panel orange"), ["protected#panel created"]);
  assert.deepEqual(await app.run("undo"), ["protected#panel deleted"]);
  assert.deepEqual(await app.run("redo"), ["protected#panel created"]);
  for (const command of ["move panel 1 2", "scale panel 2", "set panel fill blue", "front panel", "back panel", "delete panel"]) {
    assert.match((await app.run(command))[0], /^protected#panel /);
    assert.match((await app.run("undo"))[0], /^protected#panel /);
    assert.match((await app.run("redo"))[0], /^protected#panel /);
    await app.run("undo");
  }
  await app.run("create g parent");
  assert.deepEqual(await app.run("addto parent panel"), ["protected#panel moved into g#parent"]);
  assert.match((await app.run("undo"))[0], /^protected#panel /);
  assert.equal((await app.run("show panel"))[0], "g#panel  parent=svg");
  const tree = await app.run("tree panel");
  assert.equal(tree[0], "g#panel  fill=orange");
  assert.ok(tree.every((line) => !line.includes("data-kind") && !line.includes("protected#")));
});
