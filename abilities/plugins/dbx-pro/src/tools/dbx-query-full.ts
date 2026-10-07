/**
 * dbx_query_full — 完整数据查询 Agent 工具（v0.0.109 新增）
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
import { engineExecuteByName } from "../shared/services/engine-client.ts";
import { ENGINE_ROW_CAP } from "../domain/workbench-settings.ts";

export interface DbxQueryFullInput {
	/** 已配置的连接名（工作台连接列表里的 name） */
	connectionName: string;
	/** SQL（建议写聚合 GROUP BY，避免明细行） */
	sql: string;
	/** 最大返回行数（默认 2000，上限 5000）——聚合查询通常 2000 行足够 */
	maxRows?: number;
	/** 查询超时（毫秒） */
	timeoutMs?: number;
}

/** 从 executeServerPage 复制的分块分页循环逻辑 */
async function executeFullPage(
	connectionName: string,
	sql: string,
	maxRows: number,
	timeoutMs: number,
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; rowCount: number; truncated: boolean; totalRows?: number }> {
	const cap = ENGINE_ROW_CAP;
	const chunkCount = Math.max(1, Math.ceil(maxRows / cap));

	let first: { columns: string[]; paged?: boolean; truncated?: boolean; row_count?: number; engine_row_count?: number } | null = null;
	const mergedRows: Record<string, unknown>[] = [];
	let totalRows: number | undefined = undefined;

	for (let chunk = 0; chunk < chunkCount; chunk += 1) {
		const baseOffset = chunk * cap;
		const raw = await engineExecuteByName(connectionName, sql, {
			timeoutMs,
			rowLimit: cap,
			page: { offset: baseOffset, limit: cap },
		});

		if (!first) {
			first = { columns: raw.columns, paged: raw.paged, truncated: raw.truncated, row_count: raw.row_count, engine_row_count: raw.engine_row_count };
			totalRows = raw.engine_row_count ?? raw.row_count;
		}
		mergedRows.push(...raw.rows);

		// 非可分页 SQL：引擎忽略 page，多次请求只会重复同一结果集
		if (!raw.paged) break;
		// 末页（不足一块）
		if (raw.rows.length < cap) break;
		// 已凑满 maxRows
		if (mergedRows.length >= maxRows) break;
	}

	const head = first as { columns: string[]; paged?: boolean; truncated?: boolean; engine_row_count?: number };
	const rows = mergedRows.slice(0, maxRows);
	// truncated = 引擎硬截断（不可分页）OR 主动 maxRows 截断
	const truncated = head.paged === true
		? totalRows !== undefined && totalRows > rows.length
		: head.truncated === true;

	return {
		columns: head.columns,
		rows,
		rowCount: rows.length,
		truncated,
		totalRows: truncated ? totalRows : undefined,
	};
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
			"Default maxRows=2000 (cap 5000). Increase only for large aggregation dimensions.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connectionName: { type: "string", description: "Configured connection name (from workbench connections list)." },
				sql: { type: "string", description: "SQL query. Prefer GROUP BY aggregation for chart data." },
				maxRows: { type: "number", description: "Max rows to return. Default 2000, cap 5000." },
				timeoutMs: { type: "number", description: "Query timeout in ms. Default 30000." },
			},
			required: ["connectionName", "sql"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connectionName, sql } = input;
			const maxRows = Math.min(input.maxRows ?? 2000, 5000); // 安全上限 5000
			const timeoutMs = input.timeoutMs ?? 30000;

			if (!connectionName?.trim()) return { ok: false, error: "connectionName is required" };
			if (!sql?.trim()) return { ok: false, error: "sql is required" };
			// 安全闸：禁止写操作
			const normalizedSql = sql.trim().toUpperCase();
			if (/^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/.test(normalizedSql)) {
				return { ok: false, error: "dbx_query_full is SELECT-only. Use connection write tools for mutations." };
			}

			try {
				const result = await executeFullPage(connectionName, sql, maxRows, timeoutMs);

				let note = undefined;
				if (result.truncated) {
					if (result.totalRows !== undefined) {
						note = `Result truncated: ${result.rowCount}/${result.totalRows} rows shown. Add LIMIT or narrow filters.`;
					} else {
						note = `Result truncated at ENGINE_ROW_CAP (non-pageable SQL).`;
					}
				}

				return {
					ok: true,
					columns: result.columns,
					rows: result.rows,
					rowCount: result.rowCount,
					...(note ? { note } : {}),
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
