/**
 * agent 工具 code_graph_query：符号/引用查询（不必 grep 遍历）。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { CodeMapStore } from "./codemap-store";

export interface CodeGraphQueryInput {
	query: string;
	kind?: "function" | "class" | "method" | "const" | "interface";
}

export function registerCodeMapTool(ctx: PluginContext, store: CodeMapStore): void {
	ctx.agent.registerTool({
		id: "as-codemap.query",
		name: "code_graph_query",
		label: "Code Graph",
		description: [
			"Query the workspace code graph: find symbols by name and see who references them.",
			"",
			"When to use: you need to locate a function/class/const/interface and understand its callers, or answer 'where is X defined / who uses X' without grepping the whole tree.",
			"Do NOT use for: reading file contents (use read), text search without symbol intent (use grep), or cross-project queries (single workspace only).",
			"",
			"Input: {\"query\": \"buildSummary\", \"kind\": \"function\"?} — kind optional filter.",
			"Returns: matching symbols with file:line, plus reference counts per file.",
			"",
			"Note: the graph is a lexical (regex-based) symbol index for topological navigation — precise enough for TS/JS structure, but it may over-match same-named locals. If a result looks wrong, verify by reading the file.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Symbol name substring to search" },
				kind: {
					type: "string",
					enum: ["function", "class", "method", "const", "interface"],
					description: "Optional symbol kind filter",
				},
			},
			required: ["query"],
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 10_000,
		async handler({ trigger }) {
			const input = trigger.input as CodeGraphQueryInput;
			const result = store.query(input.query, input.kind);
			return { content: [{ type: "text", text: result }] };
		},
	});
}
