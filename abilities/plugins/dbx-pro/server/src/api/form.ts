/**
 * form.mjs — 在线表单设计 JSON CRUD（desform 对等）。
 *
 *   POST /api/form/save   — 保存表单设计 JSON（upsert）
 *   POST /api/form/query  — 按 id 取单条
 *   POST /api/form/list   — 列表（keyword + limit）
 *   POST /api/form/delete — 删除
 *
 * 参数：name（表单名）、data（表单设计 JSON）、meta（版本/标签/状态等可选元数据）。
 * AI 工作流：宿主 Agent 读 references/desform-widget-types.md 等知识 →
 *   生成表单设计 JSON → 调 /api/form/save 存 DuckDB → 返回 id。
 * 表单渲染执行（Java 后端逻辑）由宿主侧处理。
 */
import { engineError } from "../engine/protocol.ts";
import * as store from "./json-store.ts";

const TABLE = "dbx_form_designs";

export function formRoutes(ctx) {
	return [
		["/api/form/save", "POST", true, async ({ body }) => {
			const id = body?.id ?? null;
			const name = body?.name;
			const data = body?.data;
			const meta = body?.meta ?? {};
			if (!name || !data) throw engineError("BAD_REQUEST", "name + data 必填");
			return store.save(ctx, { table: TABLE, id, name, data, meta });
		}],
		["/api/form/query", "POST", true, async ({ body }) => {
			const r = await store.queryById(ctx, { table: TABLE, id: body?.id });
			if (!r) throw engineError("NOT_FOUND", `form ${body?.id} 不存在`);
			return r;
		}],
		["/api/form/list", "POST", true, async ({ body }) => {
			return store.list(ctx, { table: TABLE, keyword: body?.keyword ?? "", limit: body?.limit ?? 100 });
		}],
		["/api/form/delete", "POST", true, async ({ body }) => {
			return store.remove(ctx, { table: TABLE, id: body?.id });
		}],
	];
}
