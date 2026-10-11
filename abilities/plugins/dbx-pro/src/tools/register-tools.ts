/**
 * Agent 工具注册。
 *
 * 1. dbx_query_full — 完整查询（自动分页拼页，绕过 1000 行上限）
 *    工作台的 executeServerPage 分块循环直接暴露给 Agent。
 *
 * 2. dbx_chart_collection — 打包看板/大屏（ECharts charts[] → HTML 页面）
 *    渲染引擎已从 Chart.js 切换为 ECharts（ADR-0010b）。
 *
 * 3. dbx_bigscreen_builder — JimuBI 紧凑 spec → ECharts option + HTML
 *    对等实现 jimubi-bigscreen spec_builder.py（ADR-0010a）。
 *
 * 4. dbx_report_builder — Jimureport 对等实现
 *    SQL + 参数化 + 多级表头 → HTML 报表（ADR-0010a）。
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

// 注意：dbx_bigscreen_builder 和 dbx_report_builder 目前是 TypeScript 纯函数模块，
// 不是直接注册到 Agent 的 PluginAgentToolRegistration（与 dbx_chart_collection 不同）。
// 它们被 dbx_chart_collection 和前端 UI 内部调用。
// 如果后续需要暴露为独立 Agent 工具，按 dbx_chart_collection 的 createDbxChartCollectionTool 模式注册。
