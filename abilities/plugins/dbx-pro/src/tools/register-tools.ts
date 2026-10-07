/**
 * Agent 工具注册（v0.0.103 简化版）。
 *
 * 只注册一个高阶可视化工具：dbx_chart_collection。
 * 旧的 dbx_dashboard / dbx_screen（内联 SQL 模板 + Canvas 规则引擎）已移除。
 *
 * 宿主 Agent 自己查数据、编排多个 Chart.js charts[] 数组，
 * 然后调用本工具打包成完整页面看板/大屏。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createDbxChartCollectionTool } from "./dbx-chart-collection";

export function registerTools(ctx: PluginContext): Disposable[] {
	return [ctx.agent.registerTool(createDbxChartCollectionTool())];
}
