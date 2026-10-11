/**
 * Agent 工具注册。
 *
 * 1. dbx_query_full — 完整查询（自动分页拼页，绕过 1000 行上限）
 *    工作台的 executeServerPage 分块循环直接暴露给 Agent。
 *
 * 2. dbx_chart_collection — 打包看板/大屏（ECharts charts[] → HTML 页面）
 *    渲染引擎已从 Chart.js 切换为 ECharts（ADR-0010b）。
 *
 * 3. dbx_execute_write — 写操作工具（INSERT/UPDATE/DELETE，自动事务 + 影响行数校验）。
 *
 * 注：大屏/报表编译已统一走 server 端 /api/bigscreen/compile，
 * 前端不做本地编译（Phase C1 后彻底移除了 dbx-bigscreen-builder / dbx-report-builder 两个死代码模块）。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createDbxQueryFullTool } from "./dbx-query-full";
import { createDbxChartCollectionTool } from "./dbx-chart-collection";
import { createDbxExecuteWriteTool } from "./dbx-execute-write";

export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDbxQueryFullTool()),
		ctx.agent.registerTool(createDbxExecuteWriteTool()),
		ctx.agent.registerTool(createDbxChartCollectionTool()),
	];
}
