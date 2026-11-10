// 用途：验证四类扩展的注册、清单一致性、失败回滚和生命周期资源释放。
const assert = require("node:assert/strict");
const test = require("node:test");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { EditorSession } = require("../dist/application/EditorSession.js");

class TestPlugin {
  constructor(activate) { this.action = activate; }
  activate(context, options) { return this.action(context, options); }
}

const command = (name) => ({ name, syntax: name, description: "probe", create: () => ({ execute: () => ({ lines: [name] }) }) });
const shape = (name) => ({ name, create: () => "created", createFromParameters: () => "created", createFromSvg: () => "restored" });
const decorator = (name) => ({ name, order: 1, getSuffix: () => "tag" });
const attribute = (name) => ({ name, handles: () => true, apply: (context) => context.setAttribute("r", "fill", "red") });
const createHost = () => new PluginHost({ editor: new EditorSession(), directory: {} });

test("four extension types register together and preserve instance behavior and options", () => {
  const host = createHost();
  const options = { color: "red" };
  host.activate({ name: "probe", contributes: { shapes: ["shape"], commands: ["cmd"], decorators: ["tag"], attributes: ["attr"] } },
    new TestPlugin((ctx, received) => {
      assert.equal(received, options);
      assert.equal(host.commands.has("cmd"), false);
      ctx.registerShape(shape("shape")); ctx.registerCommand(command("cmd"));
      ctx.registerDecorator(decorator("tag")); ctx.registerAttributeHandler(attribute("attr"));
    }), options);
  assert.equal(host.shapes.get("shape").createFromParameters(), "created");
  assert.equal(host.shapes.get("shape").createFromSvg(), "restored");
  assert.deepEqual(host.commands.create({ name: "cmd", arguments: [] }).execute(), { lines: ["cmd"] });
  assert.equal(host.decorators.get("tag").getSuffix({}), "tag");
  assert.equal(host.attributes.get("attr").handles({}, "fill"), true);
  const writes = [];
  host.attributes.get("attr").apply({ setAttribute: (...args) => writes.push(args) });
  assert.deepEqual(writes, [["r", "fill", "red"]]);
});

test("missing declarations and empty plugin sets have empty default behavior", () => {
  const host = createHost();
  host.activate({ name: "empty" }, new TestPlugin(() => {}));
  for (const registry of [host.commands, host.shapes, host.decorators, host.attributes]) assert.deepEqual(registry.getAll(), []);
});

test("raw manifest values cannot use null, arrays or non-array name lists as empty declarations", () => {
  for (const contributes of [null, [], "invalid", { commands: null }, { shapes: "rect" }, { attributes: [42] }]) {
    const host = createHost();
    assert.throws(() => host.activate({ name: "bad-json", contributes }, new TestPlugin(() => {})),
      /plugin failed to activate: bad-json \(invalid contributes declaration\)/);
    for (const registry of [host.commands, host.shapes, host.decorators, host.attributes]) assert.deepEqual(registry.getAll(), []);
  }
});

test("activation failure rolls back all four categories and releases resources in reverse order", () => {
  const host = createHost();
  const released = [];
  assert.throws(() => host.activate({ name: "broken" }, new TestPlugin((ctx) => {
    ctx.registerCommand(command("cmd")); ctx.registerShape(shape("shape"));
    ctx.registerDecorator(decorator("tag")); ctx.registerAttributeHandler(attribute("attr"));
    ctx.addDisposable({ dispose: () => released.push(1) });
    ctx.addDisposable({ dispose: () => { released.push(2); throw new Error("cleanup error"); } });
    throw new Error("original failure");
  })), /plugin failed to activate: broken \(original failure\)/);
  assert.deepEqual(released, [2, 1]);
  for (const registry of [host.commands, host.shapes, host.decorators, host.attributes]) assert.deepEqual(registry.getAll(), []);
});

test("manifest mismatch rejects names or categories without publishing staged registrations", () => {
  const host = createHost();
  for (const contributes of [{ commands: ["different"] }, { shapes: ["cmd"] }, { commands: ["cmd", "cmd"] }]) {
    assert.throws(() => host.activate({ name: "mismatch", contributes }, new TestPlugin(ctx => ctx.registerCommand(command("cmd")))),
      /plugin manifest mismatch: mismatch \(declared: .*registered:/);
    assert.equal(host.commands.has("cmd"), false);
  }
});

test("duplicate registrations preserve an earlier plugin and do not prevent the next activation", () => {
  const host = createHost();
  const manifest = { name: "first", contributes: { commands: ["same"] } };
  host.activate(manifest, new TestPlugin(ctx => ctx.registerCommand(command("same"))));
  assert.throws(() => host.activate({ name: "bad" }, new TestPlugin((ctx) => {
    ctx.registerShape(shape("temporary")); ctx.registerCommand(command("same"));
  })), /duplicate registration: commands\/same/);
  assert.equal(host.shapes.has("temporary"), false);
  assert.equal(host.commands.has("same"), true);
  host.activate({ name: "next", contributes: { decorators: ["later"] } }, new TestPlugin(ctx => ctx.registerDecorator(decorator("later"))));
  assert.equal(host.decorators.has("later"), true);
});

test("duplicates within one activation fail even when the plugin catches the registration error", () => {
  const host = createHost();
  assert.throws(() => host.activate({ name: "caught", contributes: { commands: ["same"] } }, new TestPlugin((ctx) => {
    ctx.registerCommand(command("same"));
    try { ctx.registerCommand(command("same")); } catch {}
  })), /duplicate registration: commands\/same/);
  assert.equal(host.commands.has("same"), false);
});

test("invalid extension implementations cannot be activated", () => {
  const host = createHost();
  for (const [method, entry] of [["registerShape", { name: "bad" }], ["registerDecorator", { ...decorator("bad"), order: NaN }],
    ["registerAttributeHandler", { name: "bad" }], ["registerCommand", { ...command("bad"), create: undefined }]]) {
    assert.throws(() => host.activate({ name: "invalid" }, new TestPlugin(ctx => ctx[method](entry))), /plugin failed to activate: invalid/);
  }
});

test("activation contexts close after success or failure and committed resources live until host disposal", () => {
  const host = createHost();
  let context;
  let releases = 0;
  host.activate({ name: "resources" }, new TestPlugin(ctx => {
    context = ctx; ctx.addDisposable({ dispose: () => { releases += 1; } });
  }));
  assert.equal(releases, 0);
  assert.throws(() => context.registerCommand(command("late")), /context is closed/);
  let failedContext;
  assert.throws(() => host.activate({ name: "failed-context" }, new TestPlugin(ctx => {
    failedContext = ctx;
    throw new Error("stop activation");
  })), /stop activation/);
  assert.throws(() => failedContext.registerShape(shape("late-shape")), /context is closed/);
  host.dispose(); host.dispose();
  assert.equal(releases, 1);
  assert.throws(() => host.activate({ name: "late" }, new TestPlugin(() => {})), /host is disposed/);
});

test("a commit-time contract violation rolls back entries already published in the same batch", () => {
  const host = createHost();
  const mutable = decorator("tag");
  assert.throws(() => host.activate({ name: "changed", contributes: { commands: ["cmd"], decorators: ["tag"] } }, new TestPlugin(ctx => {
    ctx.registerCommand(command("cmd")); ctx.registerDecorator(mutable); mutable.name = "changed";
  })), /registration name changed: decorators\/tag/);
  assert.equal(host.commands.has("cmd"), false);
  assert.equal(host.decorators.has("tag"), false);
  assert.equal(host.decorators.has("changed"), false);
});

test("asynchronous activation is rejected instead of committing a partial registration", () => {
  const host = createHost();
  assert.throws(() => host.activate({ name: "async" }, new TestPlugin(ctx => {
    ctx.registerCommand(command("temporary")); return Promise.resolve();
  })), /activate must register synchronously/);
  assert.equal(host.commands.has("temporary"), false);
});
