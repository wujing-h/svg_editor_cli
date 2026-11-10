// 用途：验证图形注册的缺省行为、创建与读取共享、重复保护及无效实现拒绝。
const assert = require("node:assert/strict");
const test = require("node:test");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { RectShape } = require("../dist/domain/RectShape.js");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { ShapeRegistry } = require("../dist/application/ShapeRegistry.js");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { SvgReader } = require("../dist/infrastructure/SvgReader.js");
const { BuiltinShapes } = require("../dist/builtins/BuiltinShapes.js");
const { BuiltinShapeProvider } = require("../dist/builtins/BuiltinShapeProvider.js");
const { BuiltinCommands } = require("../dist/builtins/BuiltinCommands.js");

class ProbeShapeProvider {
  constructor(name = "probe") { this.name = name; this.calls = []; }
  create(id, attributes = {}) {
    return new RectShape(id, Number(attributes.x ?? 0), 2, 3, 4, { fill: "orange" });
  }
  createFromParameters(id, parameters) {
    this.calls.push({ input: "parameters", id, parameters });
    return this.create(id, { x: parameters[0] });
  }
  createFromSvg(input) {
    this.calls.push({ input: "svg", id: input.id, tagName: input.tagName });
    return this.create(input.id, input.attributes);
  }
}

const manifest = (name) => ({ name: "test-" + name, contributes: { shapes: [name] } });
const activate = (host, provider) => host.activate(manifest(provider.name), {
  activate: (ctx) => ctx.registerShape(provider),
});

test("an empty factory has no hidden builtin types and missing providers keep the required error", () => {
  const factory = new ShapeFactory(new ShapeRegistry());
  for (const run of [() => factory.create("rect", "r"), () => factory.createFromParameters("circle", "c", []),
    () => factory.createFromSvg("g", "g", {}, "")]) {
    assert.throws(run, /unknown shape type: .*\(is the plugin loaded\?\)/);
  }
});

test("six builtin types are separately registered provider instances", () => {
  const host = new PluginHost({ editor: {}, directory: {} });
  const builtins = new BuiltinShapes();
  host.activate(builtins.manifest, builtins);
  const providers = host.shapes.getAll();
  assert.deepEqual(providers.map((provider) => provider.name), ["rect", "circle", "ellipse", "line", "text", "g"]);
  assert.equal(new Set(providers).size, 6);
  assert.ok(providers.every((provider) => provider instanceof BuiltinShapeProvider));
  assert.equal(new ShapeFactory(host.shapes).create("g", "group").isContainer(), true);
});

test("late provider activation reaches CLI creation and SVG reading through the same instance", async () => {
  const shapes = new ShapeRegistry();
  const factory = new ShapeFactory(shapes);
  const reader = new SvgReader(factory);
  const session = new EditorSession({
    read: async () => reader.parse('<svg width="400" height="300"><probe id="loaded" x="17"/></svg>'),
    save: async () => 0,
  });
  const host = new PluginHost({ editor: session, directory: {} }, shapes);
  const commands = new BuiltinCommands(session, factory);
  host.activate(commands.manifest, commands);
  const dispatcher = new CommandDispatcher(session, host.commands);
  const parser = new CommandLineParser();
  await dispatcher.dispatch(parser.parse("init"));
  await assert.rejects(dispatcher.dispatch(parser.parse("create probe first 12")), /unknown shape type: probe/);
  const provider = new ProbeShapeProvider();
  activate(host, provider);
  await dispatcher.dispatch(parser.parse("create probe first 12"));
  assert.equal(session.requireDocument().findShape("first").describe().geometry.x, 12);
  await dispatcher.dispatch(parser.parse("read supplied.svg"));
  assert.equal(session.requireDocument().findShape("loaded").describe().geometry.x, 17);
  assert.equal(session.requireDocument().findShape("loaded").describe().attributes.fill, "orange");
  assert.deepEqual(provider.calls, [
    { input: "parameters", id: "first", parameters: ["12"] },
    { input: "svg", id: "loaded", tagName: "probe" },
  ]);
});

test("duplicate type registration keeps builtin providers and rolls back the new plugin", () => {
  const host = new PluginHost({ editor: {}, directory: {} });
  const builtins = new BuiltinShapes();
  host.activate(builtins.manifest, builtins);
  const original = host.shapes.get("rect");
  assert.throws(() => host.activate({ name: "conflict" }, { activate(ctx) {
    ctx.registerShape(new ProbeShapeProvider("temporary"));
    ctx.registerShape(new ProbeShapeProvider("rect"));
  } }), /duplicate registration: shapes\/rect/);
  assert.equal(host.shapes.get("rect"), original);
  assert.equal(host.shapes.has("temporary"), false);
  assert.equal(new ShapeFactory(host.shapes).create("rect", "r", { x: 1, y: 2, width: 3, height: 4 }).describe().attributes.fill, undefined);
});

test("provider outputs must be detached Shape objects with the requested ID", () => {
  const active = new RectShape("wanted", 0, 0, 1, 1);
  new SvgDocument(10, 10).insert(active);
  for (const result of [{}, null, new RectShape("wrong", 0, 0, 1, 1), active]) {
    const registry = new ShapeRegistry();
    registry.register({ name: "bad", create: () => result, createFromParameters: () => result, createFromSvg: () => result });
    const factory = new ShapeFactory(registry);
    for (const run of [() => factory.create("bad", "wanted"), () => factory.createFromParameters("bad", "wanted", []),
      () => factory.createFromSvg("bad", "wanted", {}, "")]) assert.throws(run, /invalid shape implementation: bad/);
  }
});

test("provider failure leaves the current tree and redo history available", async () => {
  const shapes = new ShapeRegistry();
  const factory = new ShapeFactory(shapes);
  const session = new EditorSession();
  const host = new PluginHost({ editor: session, directory: {} }, shapes);
  const builtins = new BuiltinShapes();
  host.activate(builtins.manifest, builtins);
  const commands = new BuiltinCommands(session, factory);
  host.activate(commands.manifest, commands);
  const broken = new ProbeShapeProvider("broken");
  broken.createFromParameters = () => { throw new Error("provider failed"); };
  activate(host, broken);
  const dispatcher = new CommandDispatcher(session, host.commands);
  const parser = new CommandLineParser();
  for (const line of ["init", "create rect r 1 2 3 4", "move r 10 20", "undo"]) await dispatcher.dispatch(parser.parse(line));
  const document = session.requireDocument();
  const before = document.getRootShapes().map((shape) => shape.describe());
  await assert.rejects(dispatcher.dispatch(parser.parse("create broken bad")), /provider failed/);
  assert.deepEqual(document.getRootShapes().map((shape) => shape.describe()), before);
  await dispatcher.dispatch(parser.parse("redo"));
  assert.equal(document.findShape("r").describe().geometry.x, 11);
});
