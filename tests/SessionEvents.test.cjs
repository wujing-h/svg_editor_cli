// 用途：验证成功操作事件、独立内容快照、监听器隔离与插件订阅生命周期。
"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const createDispatcher = require("./helpers/createDispatcher.cjs");
const { createSvgReader } = require("./helpers/shapes.cjs");

function editor(store, reportError) {
  const session = new EditorSession(store, reportError);
  const dispatcher = createDispatcher(session);
  const parser = new CommandLineParser();
  return { session, run: (line) => dispatcher.dispatch(parser.parse(line)) };
}
const readResult = () => createSvgReader().parse('<svg width="200" height="100"><g id="scene"><rect id="r" x="1" width="3" height="4"/></g></svg>');

test("each successful content operation emits exactly one event after state and history commit", async () => {
  const app = editor({ save: async () => 1, read: async () => readResult() });
  const events = [];
  app.session.onDidChange((event) => {
    assert.deepEqual(event.snapshot, app.session.getSnapshot());
    events.push(event);
  });
  for (const line of ["init", "create rect r 1 2 3 4", "move r 10 20", "undo", "redo", "save demo.svg", "canvas 500 400", "read other.svg"]) await app.run(line);
  assert.deepEqual(events.map((event) => event.kind), ["initialize", "edit", "edit", "undo", "redo", "save", "canvas", "read"]);
  assert.equal(events[2].snapshot.roots[0].geometry.x, 11);
  assert.equal(events[3].snapshot.roots[0].geometry.x, 1);
  assert.deepEqual(events[6].snapshot.canvas, { width: 500, height: 400 });
  assert.equal(events[7].snapshot.roots[0].children[0].id, "r");
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
  assert.equal(events.length, 8);
});

test("queries and failed edits, IO and history operations publish no successful events", async () => {
  const app = editor({ save: async () => { throw new Error("save failed"); }, read: async () => { throw new Error("read failed"); } });
  const events = [];
  app.session.onDidChange((event) => events.push(event));
  await assert.rejects(app.run("tree"));
  await app.run("help");
  await app.run("init");
  await app.run("create rect r 1 2 3 4");
  await app.run("move r 10 20");
  await app.run("undo");
  const count = events.length;
  for (const line of ["tree", "show r", "canvas", "help"]) await app.run(line);
  for (const line of ["set r width -1", "delete missing", "init -1", "canvas 0", "save demo.svg", "read bad.svg", "unknown"]) await assert.rejects(app.run(line));
  assert.equal(events.length, count);
  await app.run("redo");
  assert.equal(events.at(-1).kind, "redo");
  await assert.rejects(app.run("redo"), /nothing to redo/);
  assert.equal(events.length, count + 1);
});

test("snapshots are deeply immutable, retain old content and include all normalized tree data", async () => {
  const app = editor();
  assert.equal(app.session.getSnapshot(), undefined);
  await app.run("init");
  await app.run("create g scene");
  await app.run('create text t 1 2 "old" in scene');
  const snapshot = app.session.getSnapshot();
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.canvas));
  assert.ok(Object.isFrozen(snapshot.roots[0].children[0].attributes));
  assert.throws(() => { snapshot.roots[0].children[0].text = "changed"; }, TypeError);
  await app.run('set t text "new"');
  assert.equal(snapshot.roots[0].children[0].text, "old");
  assert.equal(app.session.getSnapshot().roots[0].children[0].text, "new");
});

test("one bad listener and a bad reporter cannot change command success, later listeners or undo/redo", async () => {
  const errors = [];
  const app = editor(undefined, (error) => { errors.push(error); throw new Error("report failed"); });
  const events = [];
  app.session.onDidChange((event) => { event.snapshot.canvas.width = 999; });
  app.session.onDidChange((event) => events.push(event));
  await app.run("init");
  await app.run("create rect r 1 2 3 4");
  await app.run("move r 10 20");
  await app.run("undo");
  await app.run("redo");
  assert.deepEqual(events.map((event) => event.kind), ["initialize", "edit", "edit", "undo", "redo"]);
  assert.equal(errors.length, 5);
  assert.ok(errors.every((error) => error.message.startsWith("session listener failed:")));
  assert.equal(app.session.getCanvasSize().width, 800);
  assert.equal(app.session.requireDocument().findShape("r").describe().geometry.x, 11);
});

test("plugin subscriptions are disposed on failed activation and host disposal", async () => {
  const app = editor();
  const host = new PluginHost({ editor: app.session, directory: {} });
  let failedCalls = 0;
  assert.throws(() => host.activate({ name: "failed" }, { activate(context) {
    context.addDisposable(context.services.editor.onDidChange(() => { failedCalls += 1; }));
    throw new Error("activation failed");
  } }), /activation failed/);
  let calls = 0;
  host.activate({ name: "observer" }, { activate(context) {
    assert.equal(context.services.editor.getSnapshot(), undefined);
    context.addDisposable(context.services.editor.onDidChange(() => { calls += 1; }));
  } });
  await app.run("init");
  assert.equal(failedCalls, 0);
  assert.equal(calls, 1);
  host.dispose();
  await app.run("create rect r 1 2 3 4");
  assert.equal(calls, 1);
});

test("subscriptions can be disposed repeatedly and the same callback can have independent subscriptions", async () => {
  const app = editor();
  let count = 0;
  const listener = () => { count += 1; };
  const first = app.session.onDidChange(listener);
  const second = app.session.onDidChange(listener);
  await app.run("init");
  assert.equal(count, 2);
  first.dispose();
  first.dispose();
  await app.run("canvas 400 300");
  assert.equal(count, 3);
  second.dispose();
  await app.run("canvas 500 400");
  assert.equal(count, 3);
});

test("save emits only after async success and retains the content given to storage as its baseline", async () => {
  let finish;
  const app = editor({ save: () => new Promise((resolve) => { finish = resolve; }) });
  await app.run("init");
  await app.run("create rect r 1 2 3 4");
  const events = [];
  app.session.onDidChange((event) => events.push(event));
  const saving = app.run("save demo.svg");
  assert.equal(events.length, 0);
  // CLI 本身逐条等待；这里直接交错调用，确认完成时不能把尚未保存的新值当作基线。
  await app.run("move r 10 20");
  finish(1);
  await saving;
  assert.deepEqual(events.map((event) => event.kind), ["edit", "save"]);
  assert.equal(events[1].snapshot.roots[0].geometry.x, 1);
  assert.equal(app.session.getSnapshot().roots[0].geometry.x, 11);
});

test("async read emits after replacement and asynchronous listener rejection is isolated", async () => {
  let finish;
  const errors = [];
  const app = editor({ read: () => new Promise((resolve) => { finish = resolve; }) }, (error) => errors.push(error));
  const events = [];
  app.session.onDidChange(async () => { throw new Error("async observer"); });
  app.session.onDidChange((event) => events.push(event));
  const reading = app.run("read loaded.svg");
  assert.equal(events.length, 0);
  assert.equal(app.session.getSnapshot(), undefined);
  finish(readResult());
  await reading;
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "read");
  assert.equal(app.session.requireDocument().findShape("r").id, "r");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /session listeners must execute synchronously/);
});

test("snapshot description errors do not turn an already committed edit or successful storage into failure", async () => {
  let saves = 0;
  const errors = [];
  const app = editor({ save: async () => { saves += 1; return 1; } }, (error) => errors.push(error));
  await app.run("init");
  await app.run("create rect r 1 2 3 4");
  const events = [];
  app.session.onDidChange((event) => events.push(event));
  const shape = app.session.requireDocument().findShape("r");
  const describe = shape.describe.bind(shape);
  shape.describe = () => { throw new Error("description failed"); };
  await app.run("scale r 2");
  await app.run("save demo.svg");
  assert.equal(saves, 1);
  assert.equal(events.length, 0);
  assert.equal(errors.length, 2);
  shape.describe = describe;
  assert.equal(shape.describe().geometry.width, 6);
  await assert.rejects(app.run("undo"), /undo not allowed after io command/);
});
