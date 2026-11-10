// 用途：按生产路径激活内置命令，为原有行为测试提供默认装配。
const { CommandDispatcher } = require("../../dist/application/CommandDispatcher.js");
const { PluginHost } = require("../../dist/application/PluginHost.js");
const { BuiltinCommands } = require("../../dist/builtins/BuiltinCommands.js");
const { BuiltinShapes } = require("../../dist/builtins/BuiltinShapes.js");
const { ShapeFactory } = require("../../dist/domain/ShapeFactory.js");
const { AttributeService } = require("../../dist/application/AttributeService.js");
const { NodeDirectoryAdapter } = require("../../dist/infrastructure/NodeDirectoryAdapter.js");

module.exports = function createDispatcher(session) {
  const host = new PluginHost({ editor: session, directory: new NodeDirectoryAdapter() });
  const shapes = new BuiltinShapes();
  host.activate(shapes.manifest, shapes);
  const builtins = new BuiltinCommands(session, new ShapeFactory(host.shapes), new AttributeService(() => host.attributes.getAll()));
  host.activate(builtins.manifest, builtins);
  return new CommandDispatcher(session, host.commands);
};
