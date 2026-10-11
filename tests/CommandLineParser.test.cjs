// 用途：验证命令解析的引号、颜色、注释及错误恢复边界。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");

test("blank lines and whole-line comments are ignored", () => {
  const parser = new CommandLineParser();
  assert.equal(parser.parse("   "), undefined);
  assert.equal(parser.parse("  # replay comment"), undefined);
});

test("color tokens are preserved", () => {
  const input = new CommandLineParser().parse("set r1 fill #4a90d9");
  assert.equal(input.name, "set");
  assert.equal(input.arguments[2].value, "#4a90d9");
});

test("quoted text keeps spaces, empty content, and keyword identity", () => {
  const parser = new CommandLineParser();
  const input = parser.parse('create text t1 20 40 "My Diagram in node" in g1');
  assert.deepEqual(input.arguments[4], { value: "My Diagram in node", quoted: true });
  assert.deepEqual(input.arguments[5], { value: "in", quoted: false });
  assert.deepEqual(parser.parse('set t1 text ""').arguments[2], { value: "", quoted: true });
});

test("quoted Windows paths and escaped quotes retain their meaning", () => {
  const parser = new CommandLineParser();
  assert.equal(parser.parse(String.raw`read "D:\my files\demo.svg"`).arguments[0].value,
    String.raw`D:\my files\demo.svg`);
  assert.equal(parser.parse(String.raw`set t1 text "say \"Hi\""`).arguments[2].value, 'say "Hi"');
});

test("invalid quotes do not affect the next parsed command", () => {
  const parser = new CommandLineParser();
  assert.throws(() => parser.parse('set t1 text "broken'), /unterminated/);
  assert.throws(() => parser.parse('help "text"suffix'), /whitespace/);
  assert.throws(() => parser.parse('"help"'), /command name/);
  assert.equal(parser.parse("help").name, "help");
});
