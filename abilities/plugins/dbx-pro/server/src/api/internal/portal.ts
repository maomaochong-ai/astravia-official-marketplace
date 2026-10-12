/**
 * portal.mjs — 门户设计 JSON CRUD（jeecg-portal 对等）。
 *   POST /api/portal/save  — 保存门户设计（布局 JSON + 组件配置）
 *   POST /api/portal/query — 按 id 取单条
 *   POST /api/portal/list  — 列表
 *   POST /api/portal/delete
 *
 * 对应 JeecgBoot /eoa/portalapp/portalDesign/add，本质是 JSON blob 存储。
 */
import { engineError } from "../../engine/protocol.ts";
import * as store from "./json-store.ts";

const TABLE = "dbx_portal_designs";

export function portalRoutes(ctx) {
	return [
		["/api/portal/save", "POST", true, async ({ body }) => {
			if (!body?.name || !body?.data) throw engineError("BAD_REQUEST", "name + data 必填");
			return store.save(ctx, { table: TABLE, id: body.id, name: body.name, data: body.data, meta: body.meta ?? {} });
		}],
		["/api/portal/query", "POST", true, async ({ body }) => {
			const r = await store.queryById(ctx, { table: TABLE, id: body?.id });
			if (!r) throw engineError("NOT_FOUND", `portal ${body?.id} 不存在`);
			return r;
		}],
		["/api/portal/list", "POST", true, async ({ body }) => {
			return store.list(ctx, { table: TABLE, keyword: body?.keyword ?? "", limit: body?.limit ?? 100 });
		}],
		["/api/portal/delete", "POST", true, async ({ body }) => {
			return store.remove(ctx, { table: TABLE, id: body?.id });
		}],
	];
}

