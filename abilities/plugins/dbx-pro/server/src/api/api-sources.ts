/**
 * api-sources.mjs — 插件自有 API 接入数据源。
 *   POST   /api-sources
 *   DELETE /api-sources
 *   POST   /api-sources/test
 */
import { engineError } from "../engine/protocol.ts";
import { isApiSourceName } from "./router-context.ts";

export function apiSourcesRoutes(ctx) {
	return [
		["/api-sources", "POST", true, async ({ body }) => {
			if (!ctx.dataDir) throw engineError("API_ENGINE_UNAVAILABLE", "服务端没有数据目录");
			const name = String(body?.name ?? "").trim();
			if (!name) throw engineError("BAD_REQUEST", "缺少连接名称");
			const listResult = await ctx.mcpClient().callTool("dbx_list_connections", {});
			const clash = ctx.parseConnections(ctx.extractText(listResult, "dbx_list_connections")).some(
				(c) => c.name.toLowerCase() === name.toLowerCase(),
			);
			if (clash) throw engineError("BAD_REQUEST", `已存在同名数据库连接「${name}」，请换一个名称`);
			const saved = ctx.upsertApiSource(ctx.dataDir, body, body?.token ?? body?.secret ?? "");
			return ctx.apiSourceToPublic(saved);
		}],

		["/api-sources", "DELETE", true, async ({ body }) => {
			if (!ctx.dataDir) throw engineError("API_ENGINE_UNAVAILABLE", "服务端没有数据目录");
			const name = body?.name;
			if (!name) throw engineError("BAD_REQUEST", "缺少 API 接入名称");
			ctx.removeApiSource(ctx.dataDir, name);
			return { deleted: name };
		}],

		["/api-sources/test", "POST", true, async ({ body }) => {
			if (!ctx.dataDir) throw engineError("API_ENGINE_UNAVAILABLE", "服务端没有数据目录");
			const draft = body?.draft ?? null;
			const name = String((draft ?? body)?.name ?? "").trim();
			if (!name) throw engineError("BAD_REQUEST", "缺少连接名称");
			const stored = ctx.findApiSource(ctx.dataDir, name);
			const secret = body?.token ?? body?.secret ?? stored?.secret ?? "";
			const merged = draft && draft.headers === undefined ? { ...draft, headers: stored?.headers ?? {} } : draft;
			const fetched = merged
				? await ctx.fetchApiSource({ ...ctx.normalizeApiSource({ ...merged, secret }), secret }, {})
				: await ctx.previewApiSource(ctx.dataDir, name);
			return {
				name, url: fetched.url, status: fetched.status,
				columns: fetched.table.columns, sample: fetched.table.rows.slice(0, 20),
				row_count: fetched.table.rows.length, total_records: fetched.table.totalRecords,
				truncated: fetched.table.truncated, duration_ms: fetched.durationMs, fetched_at: fetched.fetchedAt,
			};
		}],
	];
}
