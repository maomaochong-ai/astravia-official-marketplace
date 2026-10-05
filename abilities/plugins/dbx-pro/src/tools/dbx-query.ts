/**
 * dbx_query — 执行 SQL 查询的 Agent 工具。
 *
 * 通过引擎执行 SQL，支持 SELECT/INSERT/UPDATE/DELETE/DDL。
 * 默认只读模式，写操作需要显式授权。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, type EngineQueryOutcome } from "../shared/services/engine-client";

export interface DbxQueryInput {
	connection_name: string;
	sql: string;
	allow_write?: boolean;
	limit?: number;
	timeout_ms?: number;
}

export function createDbxQueryTool(): PluginAgentToolRegistration<DbxQueryInput> {
	return {
		id: "dbx_query",
		name: "dbx_query",
		label: "数据库查询",
		description: [
			"Execute SQL queries against configured database connections.",
			"Supports SELECT, INSERT, UPDATE, DELETE, DDL statements.",
			"Default mode is read-only; set allow_write=true for write operations.",
			"Returns columns, rows, row_count, and execution metadata.",
			"Use this tool when the user asks to query data, modify data, or execute SQL.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: {
					type: "string",
					description: "Name of the database connection to use. Must match a configured connection.",
				},
				sql: {
					type: "string",
					description: "SQL statement to execute. Can be SELECT, INSERT, UPDATE, DELETE, or DDL.",
				},
				allow_write: {
					type: "boolean",
					description: "Set to true to allow write operations (INSERT/UPDATE/DELETE/DDL). Default false.",
				},
				limit: {
					type: "integer",
					description: "Maximum number of rows to return for SELECT queries. Default 1000.",
					minimum: 1,
					maximum: 10000,
				},
				timeout_ms: {
					type: "integer",
					description: "Query timeout in milliseconds. Default 30000, max 300000.",
					minimum: 1000,
					maximum: 300000,
				},
			},
			required: ["connection_name", "sql"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, sql, allow_write, limit, timeout_ms } = input;

			if (!connection_name || typeof connection_name !== "string") {
				return { ok: false, error: "connection_name is required and must be a string" };
			}
			if (!sql || typeof sql !== "string") {
				return { ok: false, error: "sql is required and must be a string" };
			}

			try {
				const outcome: EngineQueryOutcome = await engineExecuteByName(
					connection_name,
					sql,
					{
						allowWrite: allow_write === true,
						rowLimit: limit ?? 1000,
						timeoutMs: timeout_ms ?? 30000,
					},
				);

				return {
					ok: true,
					connection: outcome.connection,
					kind: outcome.kind,
					columns: outcome.columns,
					rows: outcome.rows,
					row_count: outcome.row_count,
					affected_rows: outcome.affected_rows,
					duration_ms: outcome.duration_ms,
					statement_count: outcome.statement_count,
					truncated: outcome.truncated,
					max_rows: outcome.max_rows,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return { ok: false, error: message };
			}
		},
	};
}
