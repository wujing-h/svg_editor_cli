// 用途：按生产路径激活内置命令，为原有行为测试提供默认装配。
const { CommandDispatcher } = require("../../dist/application/CommandDispatcher.js");
const { PluginHost } = require("../../dist/application/PluginHost.js");
const { BuiltinCommands } = require("../../dist/builtins/BuiltinCommands.js");
const { NodeDirectoryAdapter } = require("../../dist/infrastructure/NodeDirectoryAdapter.js");

module.exports = function createDispatcher(session) {
  const host = new PluginHost({ editor: session, directory: new NodeDirectoryAdapter() });
  const builtins = new BuiltinCommands(session);
  host.activate(builtins.manifest, builtins);
  return new CommandDispatcher(session, host.commands);
};
