// 用途：通过短命令脚本验证 CLI 在错误后继续执行，并能在 EOF 时退出。
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

test("CLI handles comments, errors, help, and EOF sequentially", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "../dist/main.js")], {
    input: '# comment\n\nunknown\nhelp extra\nhelp\n',
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /error: unknown command: unknown/);
  assert.match(result.stdout, /error: usage: help/);
  assert.match(result.stdout, /help\s+show available commands/);
  assert.doesNotMatch(result.stdout, /svg> /);
});

test("CLI creates, resizes, and queries a canvas sequentially after errors", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "../dist/main.js")], {
    input: "canvas\ninit\ncanvas 640 480\ncanvas 999 -1\ncanvas\ninit 0 100\ncanvas\n",
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(result.stdout.trim().split(/\r?\n/).slice(1), [
    "error: no document. use 'init' or 'read' first",
    "canvas 800x600 created",
    "canvas resized to 640x480",
    "error: canvas dimensions must be finite and positive",
    "canvas 640x480",
    "error: canvas dimensions must be finite and positive",
    "canvas 640x480",
  ]);
});

test("CLI creates, moves, and restores shapes sequentially with the required history errors", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "../dist/main.js")], {
    input: "init\nundo\ncreate g scene\ncreate circle c1 100 100 20 red in scene\nmove c1 30 0\nundo\nredo\ncanvas\nundo\nmove missing 1 2\nredo\ncanvas 400 300\nredo\n",
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(result.stdout.trim().split(/\r?\n/).slice(1), [
    "canvas 800x600 created",
    "error: undo not allowed after io command",
    "g#scene created",
    "circle#c1 created in g#scene",
    "circle#c1 moved to (130,100)",
    "circle#c1 moved back to (100,100)",
    "circle#c1 moved to (130,100)",
    "canvas 800x600",
    "circle#c1 moved back to (100,100)",
    "error: no such shape: missing",
    "circle#c1 moved to (130,100)",
    "canvas resized to 400x300",
    "error: undo not allowed after io command",
  ]);
});
