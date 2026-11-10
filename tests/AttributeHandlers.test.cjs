// 用途：验证属性策略选择、多对象局部事务、失败补偿及统一 undo/redo 历史。
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { AttributeService } = require("../dist/application/AttributeService.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { BuiltinCommands } = require("../dist/builtins/BuiltinCommands.js");
const { BuiltinShapes } = require("../dist/builtins/BuiltinShapes.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { RectShape } = require("pj/plugin-api");
const { ProtectedGroup } = require("./helpers/ProtectedGroup.cjs");

async function editor() {
  const session = new EditorSession();
  const host = new PluginHost({ editor: session, directory: {} });
  const shapes = new BuiltinShapes();
  host.activate(shapes.manifest, shapes);
  const commands = new BuiltinCommands(session, new ShapeFactory(host.shapes), new AttributeService(() => host.attributes.getAll()));
  host.activate(commands.manifest, commands);
  const dispatcher = new CommandDispatcher(session, host.commands);
  const parser = new CommandLineParser();
  const formatter = new CliFormatter();
  const run = async (line) => formatter.format(await dispatcher.dispatch(parser.parse(line)));
  await run("init");
  const document = session.requireDocument();
  const panel = new ProtectedGroup("panel");
  document.insert(panel);
  return {
    run, document, panel,
    body: document.findShape("panel-body"), caption: document.findShape("panel-caption"),
    snapshot: () => document.getRootShapes().map((shape) => shape.describe()),
    register(handler) {
      host.activate({ name: handler.name, contributes: { attributes: [handler.name] } }, {
        activate: (context) => context.registerAttributeHandler(handler),
      });
    },
  };
}

const handler = (apply, name = "test-attributes", attribute = "bundle") => ({
  name, handles: (shape, attr) => shape.type === "protected" && attr === attribute, apply,
});
const setBundle = (context, shape, _attribute, value) => {
  context.setAttribute(`${shape.id}-body`, "fill", value);
  context.setAttribute(`${shape.id}-caption`, "text", value);
};

test("no matching handler preserves the original whitelist and default attribute feedback", async () => {
  const app = await editor();
  app.register(handler(() => { throw new Error("unmatched handler ran"); }));
  assert.deepEqual(await app.run("set panel fill red"), ['protected#panel updated: fill="red"']);
  assert.equal(app.panel.describe().attributes.fill, "red");
  assert.equal(app.body.describe().attributes.fill, undefined);
  assert.deepEqual(await app.run("undo"), ["protected#panel updated: fill=(unset)"]);
  await assert.rejects(app.run("set panel label title"), /unknown attribute: label/);
  await app.run("redo");
  assert.equal(app.panel.describe().attributes.fill, "red");
});

test("late registered handlers override a standard attribute without changing the group's own style", async () => {
  const app = await editor();
  let calls = 0;
  app.register(handler((context, shape, _attr, value) => {
    calls += 1;
    context.setAttribute(`${shape.id}-body`, "fill", value);
  }, "paint", "fill"));
  const before = app.snapshot();
  assert.deepEqual(await app.run("set panel fill red"), ['protected#panel updated: fill="red"']);
  assert.equal(app.body.describe().attributes.fill, "red");
  assert.equal(app.panel.describe().attributes.fill, undefined);
  assert.deepEqual(await app.run("undo"), ["protected#panel update undone: fill"]);
  assert.deepEqual(app.snapshot(), before);
  await app.run("redo");
  assert.equal(app.body.describe().attributes.fill, "red");
  assert.equal(calls, 1); // 重做恢复保存的最终值，不重新调用有业务逻辑的处理器。
});

test("multiple object writes and repeated fields make exactly one history unit with exact absence restoration", async () => {
  const app = await editor();
  app.register(handler((context, shape, attr, value) => {
    setBundle(context, shape, attr, value);
    context.setAttribute(`${shape.id}-body`, "fill", "");
    context.setAttribute(`${shape.id}-body`, "fill", value);
    context.setAttribute(`${shape.id}-body`, "stroke", "");
    context.setAttribute(`${shape.id}-caption`, "stroke-width", 0);
    assert.equal(context.getShape(`${shape.id}-caption`).text, value);
  }));
  const before = app.snapshot();
  await app.run("set panel bundle none");
  const after = app.snapshot();
  assert.equal(app.body.describe().attributes.fill, "none");
  assert.equal(app.body.describe().attributes.stroke, "");
  assert.equal(app.caption.describe().attributes["stroke-width"], 0);
  await app.run("undo");
  assert.deepEqual(app.snapshot(), before);
  await assert.rejects(app.run("undo"), /nothing to undo/);
  await app.run("redo");
  assert.deepEqual(app.snapshot(), after);
});

test("throwing after two actual writes rolls back both objects, preserves redo and never falls back", async () => {
  const app = await editor();
  app.register(handler((context, shape, attr, value) => {
    setBundle(context, shape, attr, value);
    assert.equal(app.body.describe().attributes.fill, value);
    assert.equal(app.caption.describe().text, value);
    throw new Error("handler failed after writes");
  }, "broken-paint", "fill"));
  await app.run("move panel 10 20");
  await app.run("undo");
  const before = app.snapshot();
  await assert.rejects(app.run("set panel fill red"), /handler failed after writes/);
  assert.deepEqual(app.snapshot(), before);
  await app.run("redo");
  assert.equal(app.body.describe().geometry.x, 11);
});

test("a handler cannot commit partial changes by swallowing a transaction write error", async () => {
  const app = await editor();
  app.register(handler((context, shape, attr, value) => {
    setBundle(context, shape, attr, value);
    assert.throws(() => context.setAttribute(`${shape.id}-body`, "width", -1), /non-negative/);
  }));
  const before = app.snapshot();
  await assert.rejects(app.run("set panel bundle red"), /non-negative/);
  assert.deepEqual(app.snapshot(), before);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});

test("multiple matches reject before any apply and preserve an existing redo", async () => {
  const app = await editor();
  let calls = 0;
  for (const name of ["first", "second"]) app.register(handler(() => { calls += 1; }, name, "fill"));
  await app.run("move panel 10 20");
  await app.run("undo");
  const before = app.snapshot();
  await assert.rejects(app.run("set panel fill red"), /multiple attribute handlers: panel\/fill \(first, second\)/);
  assert.equal(calls, 0);
  assert.deepEqual(app.snapshot(), before);
  await app.run("redo");
});

test("every affected object's identity is checked before undo writes any values", async () => {
  const app = await editor();
  app.register(handler(setBundle));
  await app.run("set panel bundle red");
  app.document.insert(new RectShape("unrelated", 0, 0, 1, 1));
  // 用另一个图形模拟子部件身份失效；必要部件本身仍受结构规则保护。
  app.register(handler((context) => {
    context.setAttribute("unrelated", "fill", "blue");
    context.setAttribute("panel-caption", "text", "blue");
  }, "other", "other"));
  await app.run("set panel other blue");
  const location = app.document.remove("unrelated");
  app.document.insert(new RectShape("unrelated", 0, 0, 2, 2));
  const before = app.snapshot();
  await assert.rejects(app.run("undo"), /attribute target is no longer in this document: unrelated/);
  assert.deepEqual(app.snapshot(), before);
  app.document.remove("unrelated");
  app.document.restore(location);
  await app.run("undo");
  assert.equal(app.caption.describe().text, "red");
});

test("undo compensates earlier and currently failing writes, leaves history retryable and keeps unrelated fields", async () => {
  const app = await editor();
  app.register(handler(setBundle));
  app.body.setAttribute("fill", "old");
  await app.run("set panel bundle red");
  app.body.setAttribute("y", 999);
  const before = app.snapshot();
  const restore = app.body.restoreAttribute.bind(app.body);
  let attempts = 0;
  app.body.restoreAttribute = (snapshot) => {
    restore(snapshot);
    if (snapshot.getValue(app.body) === "old") {
      attempts += 1;
      assert.equal(app.caption.describe().text, "title"); // 另一对象已经恢复，随后当前对象才失败。
      throw new Error("undo failed after mutation");
    }
  };
  await assert.rejects(app.run("undo"), /undo failed after mutation/);
  assert.equal(attempts, 1);
  assert.deepEqual(app.snapshot(), before);
  app.body.restoreAttribute = restore;
  await app.run("undo");
  assert.equal(app.body.describe().attributes.fill, "old");
  assert.equal(app.body.describe().geometry.y, 999);
  assert.equal(app.caption.describe().text, "title");
});

test("redo compensates a later failure and retries the same saved values without running the handler", async () => {
  const app = await editor();
  let calls = 0;
  app.register(handler((...args) => { calls += 1; setBundle(...args); }));
  await app.run("set panel bundle red");
  await app.run("undo");
  const before = app.snapshot();
  const restore = app.caption.restoreAttribute.bind(app.caption);
  app.caption.restoreAttribute = (snapshot) => {
    restore(snapshot);
    if (snapshot.getValue(app.caption) === "red") {
      assert.equal(app.body.describe().attributes.fill, "red");
      throw new Error("redo failed after mutation");
    }
  };
  await assert.rejects(app.run("redo"), /redo failed after mutation/);
  assert.deepEqual(app.snapshot(), before);
  app.caption.restoreAttribute = restore;
  await app.run("redo");
  assert.equal(app.body.describe().attributes.fill, "red");
  assert.equal(app.caption.describe().text, "red");
  assert.equal(calls, 1);
});

test("handlers receive frozen independent descriptions and a closed context after success or failure", async () => {
  for (const fail of [false, true]) {
    const app = await editor();
    let retained;
    app.register(handler((context, shape) => {
      retained = context;
      assert.deepEqual(Object.keys(context).sort(), ["getShape", "setAttribute"]);
      assert.ok(Object.isFrozen(shape.children));
      assert.ok(Object.isFrozen(shape.children[0].attributes));
      assert.ok(Object.isFrozen(context.getShape("panel-body").geometry));
      assert.throws(() => { shape.children[0].attributes.fill = "outside"; }, TypeError);
      context.setAttribute("panel-body", "fill", "red");
      if (fail) throw new Error("close after failure");
    }));
    if (fail) await assert.rejects(app.run("set panel bundle red"), /close after failure/);
    else await app.run("set panel bundle red");
    const before = app.snapshot();
    assert.throws(() => retained.getShape("panel"), /attribute transaction is closed/);
    assert.throws(() => retained.setAttribute("panel-body", "fill", "late"), /attribute transaction is closed/);
    assert.deepEqual(app.snapshot(), before);
  }
});

test("asynchronous apply is rejected, synchronous prefix writes roll back and late writes are closed", async () => {
  const app = await editor();
  let resume;
  const gate = new Promise((resolve) => { resume = resolve; });
  let lateError;
  app.register(handler(async (context) => {
    context.setAttribute("panel-body", "fill", "red");
    await gate;
    try { context.setAttribute("panel-caption", "text", "late"); }
    catch (error) { lateError = error; }
  }));
  const before = app.snapshot();
  await assert.rejects(app.run("set panel bundle red"), /attribute handlers must execute synchronously/);
  assert.deepEqual(app.snapshot(), before);
  resume();
  await gate;
  await Promise.resolve();
  assert.match(lateError.message, /attribute transaction is closed/);
  assert.deepEqual(app.snapshot(), before);
});

test("handles exceptions, non-boolean matches and asynchronous matches never become fallback edits", async () => {
  for (const handles of [() => { throw new Error("match failed"); }, () => "yes", async () => true]) {
    const app = await editor();
    app.register({ name: "bad-match", handles, apply: () => assert.fail("apply must not run") });
    const before = app.snapshot();
    await assert.rejects(app.run("set panel fill red"), /match failed|invalid attribute handler match|must execute synchronously/);
    assert.deepEqual(app.snapshot(), before);
    await assert.rejects(app.run("undo"), /undo not allowed after io command/);
  }
});
