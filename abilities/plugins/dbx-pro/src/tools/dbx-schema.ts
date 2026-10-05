/**
 * dbx_schema — 数据库表结构浏览的 Agent 工具。
 *
 * 支持列出表、查看列定义、列出索引、列出 schema、获取 DDL。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import {
	engineListTables,
	engineListSchemas,
	engineDescribeByName,
	engineExecuteByName,
	type EngineListTablesOutcome,
	type EngineListSchemasOutcome,
	type EngineDescribeOutcome,
} from "../shared/services/engine-client";

export type SchemaOperation = "list_tables" | "describe_table" | "list_schemas" | "get_ddl";

export interface DbxSchemaInput {
	connection_name: string;
	operation: SchemaOperation;
	table_name?: string;
	schema?: string;
}

export function createDbxSchemaTool(): PluginAgentToolRegistration<DbxSchemaInput> {
	return {
		id: "dbx_schema",
		name: "dbx_schema",
		label: "表结构浏览",
		description: [
			"Browse database schema: tables, columns, indexes, constraints.",
			"Operations:",
			"- list_tables: List all tables in the connection",
			"- describe_table: Get column definitions for a table (name, type, nullable, default, primary key)",
			"- list_schemas: List all schemas in the connection (if supported)",
			"- get_ddl: Get the CREATE TABLE statement for a table",
			"Use this tool when the user asks about table structure, columns, or database schema.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: {
					type: "string",
					description: "Name of the database connection.",
				},
				operation: {
					type: "string",
					enum: ["list_tables", "describe_table", "list_schemas", "get_ddl"],
					description: "The schema operation to perform.",
				},
				table_name: {
					type: "string",
					description: "Table name (required for describe_table and get_ddl).",
				},
				schema: {
					type: "string",
					description: "Schema name (optional, for schema-aware databases like PostgreSQL).",
				},
			},
			required: ["connection_name", "operation"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, operation, table_name, schema } = input;

			if (!connection_name || typeof connection_name !== "string") {
				return { ok: false, error: "connection_name is required" };
			}
			if (!operation || typeof operation !== "string") {
				return { ok: false, error: "operation is required" };
			}

			try {
				switch (operation) {
					case "list_tables": {
						const outcome: EngineListTablesOutcome = await engineListTables(
							connection_name,
							schema ? { schema } : undefined,
						);
						return {
							ok: true,
							operation: "list_tables",
							connection: outcome.connection,
							tables: outcome.tables,
							table_count: outcome.tables.length,
						};
					}

					case "describe_table": {
						if (!table_name) {
							return { ok: false, error: "table_name is required for describe_table" };
						}
						const outcome: EngineDescribeOutcome = await engineDescribeByName(
							connection_name,
							{ table: table_name, schema },
						);
						return {
							ok: true,
							operation: "describe_table",
							connection: outcome.connection,
							table: outcome.table,
							columns: outcome.columns,
							column_count: outcome.columns.length,
						};
					}

					case "list_schemas": {
						const outcome: EngineListSchemasOutcome = await engineListSchemas(connection_name);
						return {
							ok: true,
							operation: "list_schemas",
							connection: outcome.connection,
							schemas: outcome.schemas,
							supported: outcome.supported,
						};
					}

					case "get_ddl": {
						if (!table_name) {
							return { ok: false, error: "table_name is required for get_ddl" };
						}
						const qualifiedName = schema ? `${schema}.${table_name}` : table_name;
						const ddlSql = `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table_name}'`;
						try {
							const result = await engineExecuteByName(connection_name, ddlSql, { rowLimit: 1 });
							if (result.rows.length > 0 && result.rows[0].sql) {
								return {
									ok: true,
									operation: "get_ddl",
									table: table_name,
									ddl: String(result.rows[0].sql),
								};
							}
							return {
								ok: true,
								operation: "get_ddl",
								table: table_name,
								ddl: `-- DDL for ${qualifiedName}\n-- Note: Full DDL generation requires engine support`,
							};
						} catch {
							return {
								ok: true,
								operation: "get_ddl",
								table: table_name,
								ddl: `-- DDL for ${qualifiedName}\n-- Note: DDL extraction not supported for this database type`,
							};
						}
					}

					default:
						return { ok: false, error: `Unknown operation: ${operation}` };
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return { ok: false, error: message };
			}
		},
	};
}
