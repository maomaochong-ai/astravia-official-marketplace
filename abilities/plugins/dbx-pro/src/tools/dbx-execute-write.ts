/**
 * dbx_execute_write — DDL/DML 写操作 Agent 工具。
 *
 * 与 dbx_query_full（SELECT-only）互补，提供写能力。
 * 引擎写 guard 默认拦截 DDL/DML，这个 tool 带 allowWrite + confirmedWriteSql 绕过。
 *
 * 安全边界：
 *   - handler 始终传 allowWrite=true + confirmedWriteSql（原样回传 SQL）
 *   - 宿主侧需要在 Agent 调用前弹窗让用户确认（宿主协作）
 *   - SQL 执行失败时返回完整错误给 AI，便于 AI 重试或回滚
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, type EngineQueryOutcome } from "../shared/services/engine-client";
import { ENGINE_ROW_CAP } from "../domain/workbench-settings";

export interface DbxExecuteWriteInput {
	/** 已配置的连接名 */
	connectionName: string;
	/** DDL/DML SQL（CREATE / DROP / ALTER / INSERT / UPDATE / DELETE / TRUNCATE） */
	sql: string;
	/** 执行超时（毫秒） */
	timeoutMs?: number;
}

/** 写操作 SQL 分类 */
function classifyWrite(sql: string): string {
	const head = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
	if (/^INSERT\b/.test(head)) return "INSERT";
	if (/^UPDATE\b/.test(head)) return "UPDATE";
	if (/^DELETE\b/.test(head)) return "DELETE";
	if (/^TRUNCATE\b/.test(head)) return "TRUNCATE";
	if (/^CREATE\b/.test(head)) return "CREATE";
	if (/^DROP\b/.test(head)) return "DROP";
	if (/^ALTER\b/.test(head)) return "ALTER";
	if (/^REPLACE\b/.test(head)) return "REPLACE";
	return "WRITE";
}

export function createDbxExecuteWriteTool(): PluginAgentToolRegistration<DbxExecuteWriteInput> {
	return {
		id: "dbx_execute_write",
		name: "dbx_execute_write",
		label: "执行写操作",
		description: [
			"Execute DDL/DML SQL statements against a configured connection.",
			"Supports: CREATE TABLE/DATABASE, DROP TABLE, ALTER TABLE, INSERT, UPDATE, DELETE, TRUNCATE.",
			"IMPORTANT: This bypasses the engine write guard and executes directly.",
			"Use ONLY when the user explicitly asks to create/modify/drop data or schema.",
			"After execution, recommend running a SELECT to verify the change.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connectionName: { type: "string", description: "Configured connection name (must be in the workspace connection list)." },
				sql: { type: "string", description: "Single DDL/DML statement. No multi-statement scripts." },
				timeoutMs: { type: "number", description: "Execution timeout ms. Default 15000." },
			},
			required: ["connectionName", "sql"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connectionName, sql } = input;
			const timeoutMs = input.timeoutMs ?? 15_000;

			if (!connectionName?.trim()) return { ok: false, error: "connectionName is required" };
			if (!sql?.trim()) return { ok: false, error: "sql is required" };

			const normalized = sql.trim().toUpperCase();
			if (/^(SELECT|WITH|PRAGMA|EXPLAIN|DESCRIBE|SHOW)\b/.test(normalized)) {
				return { ok: false, error: "dbx_execute_write is for DDL/DML only. Use dbx_query_full for SELECT." };
			}

			const op = classifyWrite(sql);

			let outcome: EngineQueryOutcome;
			try {
				outcome = await engineExecuteByName(connectionName, sql, {
					timeoutMs,
					rowLimit: ENGINE_ROW_CAP,
					allowWrite: true,
					confirmedWriteSql: sql.trim(),
				});
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return { ok: false, error: `执行失败: ${msg}`, operation: op };
			}

			// 执行成功 — 把结果（affectedRows/row_count）返回给 AI
			return {
				ok: true,
				operation: op,
				message: `${op} 执行成功`,
				affectedRows: outcome.affected_rows ?? outcome.row_count ?? null,
				elapsedMs: outcome.duration_ms,
			};
		},
	};
}
