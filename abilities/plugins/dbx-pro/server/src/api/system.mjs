/**
 * system.mjs — 系统元数据 CRUD（jeecg-system 对等）。
 *   POST /api/system/save     — 保存字典/菜单/权限等系统设计 JSON
 *   POST /api/system/query
 *   POST /api/system/list
 *   POST /api/system/delete
 *
 * 与 form/portal/bpmn 完全同构，只是表名不同（dbx_system_configs）。
 * JeecgBoot /sys/dict/add /sys/menu/add 等本质也是 MySQL 行存 JSON。
 * dbx-pro 侧只存 JSON blob，宿主侧负责真正的用户/角色/权限落地。
 */
import { engineError } from "../engine/protocol.mjs";
import * as store from "./json-store.mjs";

const TABLE = "dbx_system_configs";

export function systemRoutes(ctx) {
	return [
		["/api/system/save", "POST", true, async ({ body }) => {
			if (!body?.name || !body?.category) throw engineError("BAD_REQUEST", "name + category 必填");
			const data = { ...(body.data ?? {}), category: body.category };
			return store.save(ctx, { table: TABLE, id: body.id, name: body.name, data, meta: body.meta ?? {} });
		}],
		["/api/system/query", "POST", true, async ({ body }) => {
			const r = await store.queryById(ctx, { table: TABLE, id: body?.id });
			if (!r) throw engineError("NOT_FOUND", `system ${body?.id} 不存在`);
			return r;
		}],
		["/api/system/list", "POST", true, async ({ body }) => {
			const keyword = body?.category ? `${body.category} ${body?.keyword ?? ""}` : body?.keyword ?? "";
			return store.list(ctx, { table: TABLE, keyword, limit: body?.limit ?? 100 });
		}],
		["/api/system/delete", "POST", true, async ({ body }) => {
			return store.remove(ctx, { table: TABLE, id: body?.id });
		}],
	];
}

