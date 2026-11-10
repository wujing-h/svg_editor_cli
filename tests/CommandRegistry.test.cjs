// 用途：验证注册分发、动态帮助、重复保护和注册命令的历史行为。
const assert = require("node:assert/strict");
const test = require("node:test");
const { CommandRegistry } = require("../dist/application/CommandRegistry.js");
const { CommandDispatcher } = require("../dist/application/CommandDispatcher.js");
const { EditorSession } = require("../dist/application/EditorSession.js");
const { PluginHost } = require("../dist/application/PluginHost.js");
const { BuiltinCommands } = require("../dist/builtins/BuiltinCommands.js");
const { MoveCommand } = require("../dist/builtins/commands/MoveCommand.js");
const { CliFormatter } = require("../dist/cli/CliFormatter.js");
const { CommandLineParser } = require("../dist/cli/CommandLineParser.js");
const { createShapeFactory } = require("./helpers/shapes.cjs");

const definition = (name, create = () => ({ execute: () => ({ lines: [name] }) })) => ({
  name, syntax: name, description: "test command", create,
});

test("the package exposes supported plugin abstractions without exporting host internals", () => {
  const api = require("pj/plugin-api");
  assert.equal(typeof api.Shape, "function");
  assert.equal(typeof api.RectShape, "function");
  assert.equal(typeof api.EditCommand, "function");
  assert.equal(api.PluginHost, undefined);
  assert.equal(api.ExtensionRegistry, undefined);
});

test("an empty registry has no implicit builtins and a registered command runs without a document", async () => {
  const registry = new CommandRegistry();
  const dispatcher = new CommandDispatcher(new EditorSession(), registry);
  const parser = new CommandLineParser();
  await assert.rejects(dispatcher.dispatch(parser.parse("init")), /unknown command: init/);
  registry.register(definition("probe"));
  assert.deepEqual(new CliFormatter().format(await dispatcher.dispatch(parser.parse("probe"))), ["probe"]);
});

test("each dispatch constructs a new command with the original argument tokens", () => {
  const registry = new CommandRegistry();
  const tokens = [{ value: "with spaces", quoted: true }];
  const instances = [];
  registry.register(definition("probe", (received) => {
    assert.equal(received, tokens);
    const command = { execute: () => ({ lines: [String(instances.length)] }) };
    instances.push(command);
    return command;
  }));
  assert.notEqual(registry.create({ name: "probe", arguments: tokens }), registry.create({ name: "probe", arguments: tokens }));
});

test("duplicate or invalid definitions preserve the original registration and help metadata", () => {
  const registry = new CommandRegistry();
  const original = definition("probe");
  registry.register(original);
  original.description = "changed outside";
  assert.throws(() => registry.register(definition("probe")), /duplicate registration: commands\/probe/);
  for (const entry of [{ ...definition("bad name") }, { ...definition("bad"), syntax: "" }, { ...definition("bad"), create: undefined }]) {
    assert.throws(() => registry.register(entry));
  }
  const help = registry.getHelp();
  help[0].description = "changed through query";
  assert.deepEqual(registry.getHelp(), [{ syntax: "probe", description: "test command" }]);
});

test("a factory without an executable command is rejected", () => {
  const registry = new CommandRegistry();
  registry.register(definition("broken", () => ({})));
  assert.throws(() => registry.create({ name: "broken", arguments: [] }), /invalid command implementation: broken/);
});

test("builtins retain help order and a newly registered command appears without changing HelpCommand", async () => {
  const session = new EditorSession();
  const host = new PluginHost({ editor: session, directory: {} });
  const builtins = new BuiltinCommands(session, createShapeFactory());
  host.activate(builtins.manifest, builtins);
  const dispatcher = new CommandDispatcher(session, host.commands);
  const parser = new CommandLineParser();
  const before = await dispatcher.dispatch(parser.parse("help"));
  assert.deepEqual(before.help.map((entry) => entry.syntax.split(" ")[0]), [
    "init", "canvas", "save", "read", "create", "move", "scale", "delete", "set", "addto",
    "front", "back", "group", "ungroup", "tree", "show", "undo", "redo", "help",
  ]);
  host.commands.register(definition("probe"));
  const after = await dispatcher.dispatch(parser.parse("help"));
  assert.deepEqual(after.help.slice(0, -1), before.help);
  assert.equal(after.help.at(-1).syntax, "probe");
});

test("registered edit commands still participate in the shared undo and redo history", async () => {
  const session = new EditorSession();
  const registry = new CommandRegistry();
  session.initialize(800, 600);
  const { RectShape } = require("../dist/domain/RectShape.js");
  session.requireDocument().insert(new RectShape("r", 1, 2, 3, 4));
  registry.register(definition("nudge", (tokens) => new MoveCommand(session.requireDocument(), tokens)));
  const dispatcher = new CommandDispatcher(session, registry);
  await dispatcher.dispatch(new CommandLineParser().parse("nudge r 10 20"));
  assert.equal(session.requireDocument().findShape("r").describe().geometry.x, 11);
  session.undo();
  assert.equal(session.requireDocument().findShape("r").describe().geometry.x, 1);
  session.redo();
  assert.equal(session.requireDocument().findShape("r").describe().geometry.y, 22);
});
