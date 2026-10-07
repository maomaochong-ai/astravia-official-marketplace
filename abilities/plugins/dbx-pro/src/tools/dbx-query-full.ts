/**
 * dbx_query_full — 完整数据查询 Agent 工具。
 *
 * 解决的问题：宿主 dbx MCP execute_query 单次返回上限 1000 行（ENGINE_ROW_CAP），
 * 超了就截断。本工具复制工作台 executeServerPage 的分块循环逻辑（每次 1000 行，
 * 循环拼页直到 maxRows 或到底），让 Agent 能拿到完整聚合结果。
 *
 * 与工作台的关系：
 *   - 复用 engineExecuteByName（engine-client.ts）
 *   - 复制 executeServerPage 的分块循环（use-workbench-execution.ts:L30-76）
 *   - 非 React 上下文可直接调用（engineExecuteByName 是纯 HTTP 客户端）
 *
 * 与宿主 dbx MCP execute_query 的关系：
 *   - dbx MCP：单次查询，1000 行截断，适合快速试探
 *   - dbx_query_full：完整查询，自动分页拼页，适合完整聚合数据
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { executeServerPage } from "../shared/services/execute-server-page";

export interface DbxQueryFullInput {
	/** 已配置的连接名（工作台连接列表里的 name） */
	connectionName: string;
	/** SQL（建议写聚合 GROUP BY，避免明细行） */
	sql: string;
	/** 最大返回行数（默认 2000，无硬上限——Agent 可按需增大） */
	maxRows?: number;
	/** 查询超时（毫秒） */
	timeoutMs?: number;
}

export function createDbxQueryFullTool(): PluginAgentToolRegistration<DbxQueryFullInput> {
	return {
		id: "dbx_query_full",
		name: "dbx_query_full",
		label: "完整查询",
		description: [
			"Execute a SQL query and return COMPLETE results (auto-paginates in chunks of 1000 rows).",
			"Unlike dbx MCP execute_query which truncates at 1000 rows, this tool loops engine pagination.",
			"Use when you need full aggregation results for chart rendering.",
			"Recommended: write GROUP BY aggregation SQL, not SELECT * raw rows.",
			"Default maxRows=2000. Increase if aggregation dimensions exceed 2000 rows.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connectionName: { type: "string", description: "Configured connection name (from workbench connections list)." },
				sql: { type: "string", description: "SQL query. Prefer GROUP BY aggregation for chart data." },
				maxRows: { type: "number", description: "Max rows to return. Default 2000. Increase for large dimensions." },
				timeoutMs: { type: "number", description: "Query timeout in ms. Default 30000." },
			},
			required: ["connectionName", "sql"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connectionName, sql } = input;
			const maxRows = input.maxRows ?? 2000;
			const timeoutMs = input.timeoutMs ?? 30000;

			if (!connectionName?.trim()) return { ok: false, error: "connectionName is required" };
			if (!sql?.trim()) return { ok: false, error: "sql is required" };
			// 安全闸：禁止写操作
			const normalizedSql = sql.trim().toUpperCase();
			if (/^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/.test(normalizedSql)) {
				return { ok: false, error: "dbx_query_full is SELECT-only. Use connection write tools for mutations." };
			}

			try {
				const outcome = await executeServerPage(connectionName, sql, {
					baseOffset: 0,
					pageSize: maxRows,
					timeoutMs,
				});

				const total = outcome.total_count ?? outcome.engine_row_count;
				const rowCount = outcome.rows.length;
				const truncated = outcome.paged === true
					? total !== undefined && total > rowCount
					: outcome.truncated === true;

				let note: string | undefined;
				if (truncated) {
					if (total !== undefined) {
						note = `Result truncated: ${rowCount.toLocaleString()}/${total.toLocaleString()} rows shown. Re-run with higher maxRows if needed.`;
					} else {
						note = `Result truncated at ENGINE_ROW_CAP (non-pageable SQL).`;
					}
				}

				return {
					ok: true,
					columns: outcome.columns,
					rows: outcome.rows,
					rowCount,
					...(note ? { note } : {}),
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
