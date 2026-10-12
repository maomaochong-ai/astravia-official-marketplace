/**
 * report.mjs — Jimureport 对等报表 API。
 *   POST /api/report/exec
 *   POST /api/report/headers
 */
import { engineError } from "../../engine/protocol.ts";
import { execReport, inferHeaderTree } from "../../engine/report-executor.ts";

export function reportRoutes(ctx) {
	return [
		["/api/report/exec", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName;
			const sql = body?.sql;
			if (!connectionName || !sql) throw engineError("BAD_REQUEST", "connectionName + sql 均为必填");
			const result = await ctx.mcpClient().callTool("dbx_execute_query", {
				connection_name: connectionName, sql, max_rows: body?.maxRows ?? 1000,
			});
			if (result.isError) throw engineError("REPORT_EXEC_FAILED", ctx.textOf(result));
			const { columns, rows } = ctx.parseMarkdownTable(ctx.textOf(result));
			const aggregated = execReport({ columns, rows, options: body?.options ?? {} });
			return { columns: aggregated.columns, rows: aggregated.rows, groups: aggregated.groups, rowCount: aggregated.rows.length };
		}],

		["/api/report/headers", "POST", false, async ({ body }) => {
			const tree = inferHeaderTree(body?.columns ?? [], body?.groupBy ?? []);
			return { headers: tree };
		}],
	];
}
