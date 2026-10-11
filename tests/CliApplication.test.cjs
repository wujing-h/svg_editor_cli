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
