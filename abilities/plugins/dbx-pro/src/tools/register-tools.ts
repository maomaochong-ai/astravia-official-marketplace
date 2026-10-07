/**
 * Agent 工具注册。
 *
 * 1. dbx_query_full — 完整查询（自动分页拼页，绕过 1000 行上限）
 *    工作台的 executeServerPage 分块循环直接暴露给 Agent。
 *    Agent 用这个拿完整聚合数据，不要再用 dbx MCP execute_query（截断）。
 *
 * 2. dbx_chart_collection — 打包看板/大屏（只负责 Chart.js charts[] → HTML 页面）
 *    数据获取由 dbx_query_full / 宿主 render_chart 负责。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createDbxQueryFullTool } from "./dbx-query-full";
import { createDbxChartCollectionTool } from "./dbx-chart-collection";

export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDbxQueryFullTool()),
		ctx.agent.registerTool(createDbxChartCollectionTool()),
	];
}
