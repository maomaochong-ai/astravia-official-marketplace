/**
 * schema.mjs — 对象浏览 + schema 列举。
 *   POST /tables
 *   POST /describe
 *   POST /schema-context
 *   POST /schemas
 */
import { engineError } from "../../engine/protocol.ts";
import { schemaQueryFor } from "./router-context.ts";

export function schemaRoutes(ctx) {
	return [
		["/tables", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName ?? body?.connection?.name;
			if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
			if (ctx.dataDir && ctx.isApiSourceName(ctx.dataDir, connectionName)) {
				return { connection: connectionName, tables: [{ name: connectionName, kind: "table" }] };
			}
			const scope = body?.scope ?? {};
			const args: Record<string, unknown> = { connection_name: connectionName };
			if (scope.schema) args.schema = scope.schema;
			if (scope.database) args.database = scope.database;
			const result = await ctx.mcpClient().callTool("dbx_list_tables", args);
			const text = ctx.extractText(result, "dbx_list_tables");
			return { connection: connectionName, tables: ctx.parseTableList(text) };
		}],

		["/describe", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName ?? body?.connection?.name;
			const target = body?.target ?? { schema: body?.schema, table: body?.table };
			if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
			if (!target?.table) throw engineError("BAD_REQUEST", "缺少 table");
			if (ctx.dataDir && ctx.isApiSourceName(ctx.dataDir, connectionName)) {
				const preview = await ctx.previewApiSource(ctx.dataDir, connectionName);
				const types = ctx.inferColumnTypes(preview.records, preview.table.columns);
				return {
					connection: connectionName, table: target.table,
					columns: preview.table.columns.map((name) => ({
						name, type: types[name] ?? "varchar", nullable: true,
						hasDefault: false, defaultValue: "", comment: "API 接入：类型由本次样本值推导", isPrimaryKey: false,
					})),
				};
			}
			const args: Record<string, unknown> = { connection_name: connectionName, table: target.table };
			if (target.schema) args.schema = target.schema;
			const result = await ctx.mcpClient().callTool("dbx_describe_table", args);
			const text = ctx.extractText(result, "dbx_describe_table");
			const { rows } = ctx.parseMarkdownTable(text);
			return { connection: connectionName, table: target.table, columns: ctx.parseDescribeColumns(rows) };
		}],

		["/schema-context", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName;
			if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
			const result = await ctx.mcpClient().callTool("dbx_get_schema_context", { connection_name: connectionName });
			const text = ctx.extractText(result, "dbx_get_schema_context");
			return { connection: connectionName, schema: text };
		}],

		["/schemas", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName ?? body?.connection?.name;
			if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
			if (ctx.dataDir && ctx.isApiSourceName(ctx.dataDir, connectionName)) {
				return { connection: connectionName, schemas: [], supported: false };
			}
			const result = await ctx.mcpClient().callTool("dbx_execute_query", {
				connection_name: connectionName,
				sql: schemaQueryFor(body?.dbType),
				max_rows: 1000,
			});
			if (result.isError) {
				const err = ctx.classifyError(ctx.textOf(result));
				if (!ctx.isMissingCatalogView(err)) throw engineError(err.code, err.detail, ctx.textOf(result));
				return { connection: connectionName, schemas: [], supported: false };
			}
			const { rows } = ctx.parseMarkdownTable(ctx.textOf(result));
			const schemas = rows
				.map((row) => String(ctx.pick(row, ["schema_name", "SCHEMA_NAME", "Schema", "schema"])).trim())
				.filter((name) => name.length > 0);
			return { connection: connectionName, schemas, supported: true };
		}],
	];
}
