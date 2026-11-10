// 用途：为加载测试创建独立插件包与配置，并只清理自己生成的工作区临时目录。
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = async function pluginFixture(t) {
  const staging = path.resolve(__dirname, "../../ai-notes/staging");
  await fs.mkdir(staging, { recursive: true });
  const root = await fs.mkdtemp(path.join(staging, "plugin-loader-"));
  t.after(async () => {
    if (path.dirname(path.resolve(root)) !== staging) throw new Error("cleanup escaped staging directory");
    await fs.rm(root, { recursive: true, force: true });
  });
  return {
    root,
    async plugin(folder, manifest, source, entry = "index.cjs") {
      const directory = path.join(root, folder);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({ main: entry, ...manifest }), "utf8");
      await fs.writeFile(path.join(directory, entry), `// Plugin fixture.\n${source}`, "utf8");
      return directory;
    },
    async config(plugins, name = "plugins.config.json") {
      const target = path.join(root, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify({ plugins }), "utf8");
      return target;
    },
  };
};
