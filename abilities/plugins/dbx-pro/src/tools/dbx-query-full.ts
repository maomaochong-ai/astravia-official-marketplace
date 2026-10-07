/**
 * dbx_query_full — 完整数据查询 Agent 工具。
 *
 * 复用工作台 executeServerPage 的分块循环逻辑，自动分页拼页拿完整数据。
 * 引擎单次结果硬上限 ENGINE_ROW_CAP（默认 1000 行），分块循环让 Agent 能拿完整聚合结果。
 *
 * Token 优化：rows 默认做采样（前 50 + 后 10），避免几千行 JSON 塞满 LLM context。
 * Agent 通过 rowCount / totalRows / completeness 判断数据全不全。
 * 极少数明细图场景（scatter/bubble）Agent 可设 fullRows=true 拿完整数据。
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
	/** true 返回完整 rows（默认 false，返回前 50 + 后 10 采样） */
	fullRows?: boolean;
}

/** 对 rows 做前 N + 后 M 采样。rows ≤ N+M 时原样返回。 */
function sampleRows(
	rows: Record<string, unknown>[],
	head = 50,
	tail = 10,
): { rows: Record<string, unknown>[]; isSampled: boolean; sampleInfo?: string } {
	if (rows.length <= head + tail) {
		return { rows, isSampled: false };
	}
	const sampled = rows.slice(0, head).concat(rows.slice(-tail));
	return {
		rows: sampled,
		isSampled: true,
		sampleInfo: `Sampled: ${head} head + ${tail} tail from ${rows.length} total rows`,
	};
}

export function createDbxQueryFullTool(): PluginAgentToolRegistration<DbxQueryFullInput> {
	return {
		id: "dbx_query_full",
		name: "dbx_query_full",
		label: "完整查询",
		description: [
			"Execute a SQL query with auto-pagination (chunks of 1000 rows each).",
			"Unlike dbx MCP execute_query which truncates at 1000 rows, this tool loops pagination.",
			"IMPORTANT: rows is sampled (first 50 + last 10) to save context tokens.",
			"Check rowCount, totalRows, completeness for full data picture.",
			"Set fullRows=true ONLY for scatter/bubble detail charts that need every row.",
			"Recommended: GROUP BY aggregation SQL.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connectionName: { type: "string", description: "Configured connection name." },
				sql: { type: "string", description: "SQL query. Prefer GROUP BY aggregation." },
				maxRows: { type: "number", description: "Max rows to fetch. Default 2000." },
				timeoutMs: { type: "number", description: "Query timeout ms. Default 30000." },
				fullRows: { type: "boolean", description: "Return ALL rows (default false, sampled). Use only for scatter/bubble." },
			},
			required: ["connectionName", "sql"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connectionName, sql } = input;
			const maxRows = input.maxRows ?? 2000;
			const timeoutMs = input.timeoutMs ?? 30000;
			const wantFullRows = input.fullRows === true;

			if (!connectionName?.trim()) return { ok: false, error: "connectionName is required" };
			if (!sql?.trim()) return { ok: false, error: "sql is required" };
			const normalizedSql = sql.trim().toUpperCase();
			if (/^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/.test(normalizedSql)) {
				return { ok: false, error: "dbx_query_full is SELECT-only." };
			}

			try {
				const outcome = await executeServerPage(connectionName, sql, {
					baseOffset: 0,
					pageSize: maxRows,
					timeoutMs,
				});

				const fetchedRows = outcome.rows;
				const rowCount = fetchedRows.length;
				const paginationSupported = outcome.paged === true;

				// 完整性判断
				let completeness: "complete" | "truncated" | "unknown";
				let isTruncated: boolean;
				let totalRows: number | undefined;
				let note: string | undefined;

				if (paginationSupported) {
					totalRows = outcome.total_count ?? outcome.engine_row_count;
					if (totalRows !== undefined && rowCount >= totalRows) {
						completeness = "complete";
						isTruncated = false;
					} else if (totalRows !== undefined && rowCount < totalRows) {
						completeness = "truncated";
						isTruncated = true;
						note = `Result truncated: ${rowCount.toLocaleString()}/${totalRows.toLocaleString()} rows. Re-run with higher maxRows.`;
					} else {
						completeness = "unknown";
						isTruncated = rowCount >= maxRows;
						note = isTruncated ? `Result may be truncated — hit maxRows=${maxRows}.` : undefined;
					}
				} else {
					totalRows = undefined;
					completeness = "unknown";
					isTruncated = outcome.truncated === true || rowCount >= 1000;
					note = outcome.truncated === true
						? `Engine truncated at 1000 rows (non-pageable SQL/DB).`
						: `Pagination not supported — got ${rowCount} rows, unknown total.`;
				}

				// Token 优化：采样 rows（除非 Agent 显式要完整）
				const sampled = wantFullRows
					? { rows: fetchedRows, isSampled: false }
					: sampleRows(fetchedRows);

				return {
					ok: true,
					columns: outcome.columns,
					rows: sampled.rows,
					rowCount,
					totalRows,
					isTruncated,
					completeness,
					pagination: paginationSupported ? "supported" : "unsupported",
					isSampled: sampled.isSampled,
					...(sampled.sampleInfo ? { sampleInfo: sampled.sampleInfo } : {}),
					...(note ? { note } : {}),
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
