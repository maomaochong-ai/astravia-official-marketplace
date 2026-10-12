/**
 * bpmn.mjs — BPMN 流程设计存储（jeecg-bpmn 对等）。
 *
 *   POST /api/bpmn/save      — 保存 BPMN XML + 节点配置 JSON（设计态）
 *   POST /api/bpmn/query     — 按 id 取
 *   POST /api/bpmn/list      — 列表
 *   POST /api/bpmn/delete    — 删除
 *
 * AI 工作流边界：
 *   - ✅ 本插件负责：BPMN XML + 节点 JSON 的 CRUD（设计态存储）
 *   - ❌ 不负责：流程部署/执行/任务流转（需要 Flowable 引擎 → 宿主侧）
 *
 * 对应 JeecgBoot /act/designer/api/saveProcess（本质也是 JSON/blob 存储 + 可选部署到 Act 引擎）。
 */
import { engineError } from "../../engine/protocol.ts";
import * as store from "./json-store.ts";

const TABLE = "dbx_bpmn_designs";

export function bpmnRoutes(ctx) {
	return [
		["/api/bpmn/save", "POST", true, async ({ body }) => {
			if (!body?.name) throw engineError("BAD_REQUEST", "name 必填");
			const data = body?.data ?? body?.xml ?? {};
			return store.save(ctx, { table: TABLE, id: body.id, name: body.name, data, meta: body.meta ?? {} });
		}],
		["/api/bpmn/query", "POST", true, async ({ body }) => {
			const r = await store.queryById(ctx, { table: TABLE, id: body?.id });
			if (!r) throw engineError("NOT_FOUND", `bpmn ${body?.id} 不存在`);
			return r;
		}],
		["/api/bpmn/list", "POST", true, async ({ body }) => {
			return store.list(ctx, { table: TABLE, keyword: body?.keyword ?? "", limit: body?.limit ?? 100 });
		}],
		["/api/bpmn/delete", "POST", true, async ({ body }) => {
			return store.remove(ctx, { table: TABLE, id: body?.id });
		}],
	];
}

