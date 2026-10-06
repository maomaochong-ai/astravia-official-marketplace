/**
 * Agent 工具注册 — 将 dbx-pro 的看板/大屏能力暴露给 AI Agent。
 *
 * 基础数据库操作（查询、表结构、执行计划）已由 dbx MCP 提供，
 * 此处只注册高阶可视化能力：企业看板和数据大屏。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createDbxDashboardTool } from "./dbx-dashboard";
import { createDbxScreenTool } from "./dbx-screen";

export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDbxDashboardTool()),
		ctx.agent.registerTool(createDbxScreenTool()),
	];
}
