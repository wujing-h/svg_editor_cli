// 用途：提供 stats 插件包的默认实例和可独立测试的公开类。
import { StatsPlugin } from "./StatsPlugin.js";

export { StatsPlugin } from "./StatsPlugin.js";
export { StatsCommand } from "./StatsCommand.js";
export default new StatsPlugin();
