/**
 * agent 工具 code_graph_build：扫描当前会话工作区，重建符号-引用图。
 *
 * 面板是纯展示（只读 store，不持有 ctx），所以「构建」必须由 agent 侧触发；
 * 工具描述里明说何时用、何时别用，避免模型把它当成查询工具反复调用。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CodeMapStore } from "./codemap-store";

/**
 * 会话 cwd → 可扫描的根目录。
 *
 * tool handler 的 session.cwd 来自会话；没有项目目录的会话可能落到主进程 cwd（`/`）。
 * 拿文件系统根当工作区会把整个盘当成码谱，所以宁可拒绝。
 */
export function resolveScanRoot(cwd: string | undefined): string | null {
	const normalized = (cwd ?? "").trim().replace(/[\\/]+$/, "");
	if (!normalized) return null; // "" 或文件系统根 "/"
	if (/^[A-Za-z]:$/.test(normalized)) return null; // Windows 盘符根 "C:"
	const absolute = normalized.startsWith("/") || /^[A-Za-z]:[\\/]/.test(normalized);
	return absolute ? normalized : null;
}

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
			const root = resolveScanRoot(session.cwd);
			if (!root) {
				return {
					content: [
						{
							type: "text",
							text: `当前会话没有可扫描的工作区目录（cwd: ${session.cwd || "空"}）。请在 Astravia 里打开一个项目目录后再构建码谱。`,
						},
					],
				};
			}
			const index = await store.rebuild(root);
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
