/**
 * agent 工具 code_graph_build：扫描当前会话工作区，重建符号-引用图。
 *
 * 面板是纯展示（只读 store，不持有 ctx），所以「构建」必须由 agent 侧触发；
 * 工具描述里明说何时用、何时别用，避免模型把它当成查询工具反复调用。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CodeMapStore } from "./codemap-store";

export function registerCodeMapBuildTool(ctx: PluginContext, store: CodeMapStore): void {
	ctx.agent.registerTool({
		id: "as-codemap.build",
		name: "code_graph_build",
		label: "Build Code Graph",
		description: [
			"Build or rebuild the code map (symbol-reference graph) for the current workspace.",
			"",
			"When to use: the user asks to build/rebuild the code map (构建码谱), or code_graph_query answers that the map is not built yet.",
			"Do NOT use for: querying symbols (use code_graph_query), or scanning a different project — the scan covers the current session workspace only.",
			"",
			"Input: {} (no parameters).",
			"Returns: scanned file count and extracted symbol count; the result is also persisted per workspace for the Code Map panel.",
		].join("\n"),
		parameters: { type: "object", properties: {} },
		scope_use: ["conversation", "project"],
		timeoutMs: 120_000,
		async handler({ session }) {
			const index = await store.rebuild(session.cwd);
			return {
				content: [
					{
						type: "text",
						text: `Code map built for ${index.root}: ${index.fileCount} files, ${index.symbolCount} symbols. code_graph_query can now locate symbols and callers.`,
					},
				],
			};
		},
	});
}
