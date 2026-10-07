/**
 * 插件版本号唯一来源。
 *
 * 单独成模块而非放在 index.tsx：feature 组件（如连接管理仪表盘）要显示版本时，
 * 直接引 index 会把插件装配入口拖进懒加载 chunk 并形成循环依赖。
 * 发版时与 plugin.json / ability.json / package.json 同步递增。
 */
export const PLUGIN_VERSION = "0.0.116";
