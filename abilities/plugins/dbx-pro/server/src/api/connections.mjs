/**
 * connections.mjs — 连接管理 CRUD + 测试。
 *   GET    /connections
 *   POST   /connections
 *   DELETE /connections
 *   POST   /connections/test
 */
import { engineError } from "../engine/protocol.mjs";
import { toDbxAddParams } from "./router-context.mjs";

export function connectionsRoutes(ctx) {
	return [
		["/connections", "GET", true, async () => {
			const result = await ctx.mcpClient().callTool("dbx_list_connections", {});
			const text = ctx.extractText(result, "dbx_list_connections");
			const raw = ctx.parseConnections(text);
			const engineConnections = ctx.dedupeConnections(raw).filter((c) => c.name !== ctx.API_ENGINE_CONNECTION);
			const apiConnections = ctx.dataDir ? ctx.listApiSources(ctx.dataDir).map(ctx.apiSourceToConnection) : [];
			return { connections: [...apiConnections, ...engineConnections] };
		}],

		["/connections", "POST", true, async ({ body }) => {
			if (!body?.name || !body?.dbType) throw engineError("BAD_REQUEST", "缺少 name / dbType");
			const dbxArgs = toDbxAddParams(body);
			const result = await ctx.mcpClient().callTool("dbx_add_connection", dbxArgs);
			const text = ctx.extractText(result, "dbx_add_connection");
			const alreadyExists = /already exists/i.test(text);
			if (alreadyExists) {
				const existingList = await ctx.mcpClient().callTool("dbx_list_connections", {});
				const existingText = ctx.extractText(existingList, "dbx_list_connections");
				const existing = ctx.parseConnections(existingText).find(
					(c) => c.name.toLowerCase() === body.name.toLowerCase(),
				);
				return { id: existing?.id ?? "", name: body.name, detail: text, existing: true };
			}
			const idMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
			return { id: idMatch?.[0] ?? "", name: body.name, detail: text, existing: false };
		}],

		["/connections", "DELETE", true, async ({ body }) => {
			const name = body?.name;
			if (!name) throw engineError("BAD_REQUEST", "缺少 connection name");
			if (ctx.dataDir && ctx.isApiSourceName(ctx.dataDir, name)) {
				ctx.removeApiSource(ctx.dataDir, name);
				return { deleted: name };
			}
			const result = await ctx.mcpClient().callTool("dbx_remove_connection", { connection_name: name });
			ctx.extractText(result, "dbx_remove_connection");
			return { deleted: name };
		}],

		["/connections/test", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName;
			let tempName = null, actualName = connectionName;
			if (!connectionName && body?.draft) {
				tempName = `astravia-test-${Date.now().toString(36)}`;
				const addResult = await ctx.mcpClient().callTool("dbx_add_connection", toDbxAddParams({ ...body.draft, name: tempName }));
				ctx.extractText(addResult, "dbx_add_connection");
				actualName = tempName;
			}
			if (!actualName) throw engineError("BAD_REQUEST", "缺少 connectionName 或 draft");
			try {
				const testResult = await ctx.mcpClient().callTool("dbx_list_tables", { connection_name: actualName });
				const text = ctx.extractText(testResult, "dbx_list_tables");
				const tableCount = ctx.parseTableList(text).length;
				return { tableCount, detail: text };
			} finally {
				if (tempName) {
					try { await ctx.mcpClient().callTool("dbx_remove_connection", { connection_name: tempName }); } catch {}
				}
			}
		}],
	];
}
