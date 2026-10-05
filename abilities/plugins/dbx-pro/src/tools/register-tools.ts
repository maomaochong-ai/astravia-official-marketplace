/**
 * Agent 工具注册 — 将 dbx-pro 的数据库操作能力暴露给 AI Agent。
 *
 * 遵循 astravia-tihu 的 register-tools 模式：
 * - 每个工具定义在独立文件中
 * - 统一在此处注册到 ctx.agent.registerTool()
 * - 返回 Disposable[] 供 activate() 清理
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createDbxQueryTool } from "./dbx-query";
import { createDbxSchemaTool } from "./dbx-schema";
import { createDbxExplainTool } from "./dbx-explain";

export function registerTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool(createDbxQueryTool()),
		ctx.agent.registerTool(createDbxSchemaTool()),
		ctx.agent.registerTool(createDbxExplainTool()),
	];
}
