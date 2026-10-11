// 用途：验证画布命令的默认尺寸、参数解析以及失败时保留原状态。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");

test("init creates a default, partial, or fully specified canvas", async () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();

  const result = await dispatcher.dispatch(parser.parse("init"));
  assert.deepEqual(result.summary.values, { width: 800, height: 600 });
  assert.deepEqual(session.getCanvasSize(), { width: 800, height: 600 });

  await dispatcher.dispatch(parser.parse("init 400"));
  assert.deepEqual(session.getCanvasSize(), { width: 400, height: 600 });

  await dispatcher.dispatch(parser.parse("init 10.5 2e2"));
  assert.deepEqual(session.getCanvasSize(), { width: 10.5, height: 200 });
});

test("canvas requires a document and preserves height when only width is supplied", async () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();

  await assert.rejects(
    dispatcher.dispatch(parser.parse("canvas")),
    /no document\. use 'init' or 'read' first/,
  );

  await dispatcher.dispatch(parser.parse("init 400 300"));
  await dispatcher.dispatch(parser.parse("canvas 640"));
  assert.deepEqual(session.getCanvasSize(), { width: 640, height: 300 });

  const query = await dispatcher.dispatch(parser.parse("canvas"));
  assert.equal(query.summary.template, "canvas {width}x{height}");
  assert.deepEqual(query.summary.values, { width: 640, height: 300 });
  assert.deepEqual(session.getCanvasSize(), { width: 640, height: 300 });

  await dispatcher.dispatch(parser.parse("canvas .5 480.25"));
  assert.deepEqual(session.getCanvasSize(), { width: 0.5, height: 480.25 });
});

test("failed init and canvas leave the current canvas unchanged", async () => {
  const session = new EditorSession();
  const dispatcher = new CommandDispatcher(session);
  const parser = new CommandLineParser();

  await assert.rejects(dispatcher.dispatch(parser.parse("init 100 0")));
  assert.throws(() => session.getCanvasSize(), /no document/);
  await dispatcher.dispatch(parser.parse("init 400 300"));

  // 第二个参数也必须验证；不能先改宽度再发现高度非法。
  const invalidNumbers = ['""', '" "', "NaN", "Infinity", "1e309", "12px", "0x20", "0", "-1"];
  for (const command of ["init", "canvas"]) {
    for (const height of invalidNumbers) {
      await assert.rejects(dispatcher.dispatch(parser.parse(`${command} 999 ${height}`)));
      assert.deepEqual(session.getCanvasSize(), { width: 400, height: 300 });
    }
    await assert.rejects(
      dispatcher.dispatch(parser.parse(`${command} 100 200 extra`)),
      new RegExp(`usage: ${command}`),
    );
    assert.deepEqual(session.getCanvasSize(), { width: 400, height: 300 });
  }
});
