/**
 * dbx_query_full — 完整数据查询 Agent 工具。
 *
 * 复用工作台 executeServerPage 的分块循环逻辑，自动分页拼页拿完整数据。
 * 引擎单次结果硬上限 ENGINE_ROW_CAP（默认 1000 行），分块循环让 Agent 能拿完整聚合结果。
 *
 * 与宿主 dbx MCP execute_query 的区别：
 *   - dbx MCP：单次查询，1000 行硬截断
 *   - dbx_query_full：完整查询，自动分页拼页
 *
 * 返回契约：
 *   - ok: true, columns, rows, rowCount       → OK 正常返回
 *   - totalRows: number | undefined           → 引擎报告的真实总行数（仅分页 SQL 可用）
 *   - isTruncated: boolean                    → 是否被截断
 *   - completeness: "complete" | "unknown" | "truncated" → 明确告诉 Agent 数据完整性
 *   - note: string | undefined                → 人类可读提示
 *   - pagination: "supported" | "unsupported" → 引擎是否支持分页
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
			"Always inspect pagination and completeness fields — they tell you if the data is complete.",
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

				const rowCount = outcome.rows.length;
				const paginationSupported = outcome.paged === true;

				// 三种完整性：
				//   "complete"   — 引擎支持分页，totalRows 已知且 rows 已覆盖全部
				//   "truncated"  — 引擎支持分页但还有数据没拉完，或分页但引擎硬截断
				//   "unknown"    — 引擎不支持分页，只取了第一页的 1000 行，不知道总行数
				let completeness: "complete" | "truncated" | "unknown";
				let isTruncated: boolean;
				let totalRows: number | undefined;
				let note: string | undefined;

				if (paginationSupported) {
					// 分页 SQL：total_count / engine_row_count 是引擎报告的真实总数
					totalRows = outcome.total_count ?? outcome.engine_row_count;
					if (totalRows !== undefined && rowCount >= totalRows) {
						completeness = "complete";
						isTruncated = false;
					} else if (totalRows !== undefined && rowCount < totalRows) {
						completeness = "truncated";
						isTruncated = true;
						note = `Result truncated: ${rowCount.toLocaleString()}/${totalRows.toLocaleString()} rows. Re-run with higher maxRows.`;
					} else {
						// 分页但没报总数（edge case）
						completeness = "unknown";
						isTruncated = rowCount >= maxRows;
						note = isTruncated ? `Result may be truncated — hit maxRows=${maxRows}.` : undefined;
					}
				} else {
					// 非分页 SQL：引擎只返回了一页（1000 行），不知道总行数
					totalRows = outcome.truncated ? undefined : undefined; // 非分页时引擎不报告总数
					completeness = "unknown";
					isTruncated = outcome.truncated === true || rowCount >= 1000;
					note = outcome.truncated === true
						? `Engine truncated at 1000 rows (non-pageable SQL/DB type). Data may be incomplete.`
						: `Pagination not supported by this DB/SQL — got ${rowCount} rows, unknown total.`;
				}

				return {
					ok: true,
					columns: outcome.columns,
					rows: outcome.rows,
					rowCount,
					totalRows,
					isTruncated,
					completeness,
					pagination: paginationSupported ? "supported" : "unsupported",
					...(note ? { note } : {}),
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
