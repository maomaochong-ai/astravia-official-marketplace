/**
 * execute-server-page — 引擎分页的方言回查与透传。
 *
 * 引擎只在知道 SQL 方言时才改写分页 SQL，方言不认识时宁可报 BAD_REQUEST，
 * 也不生成可能非法的 SQL（server/src/engine/request-router.mjs）。
 * 而调用方常常只拿得到连接名 —— 数据集里存的是 connection/sql，没有 db_type ——
 * 所以缺省时 executeServerPage 按连接名回查引擎连接表。
 *
 * 这条回查是真缺陷的回归保护：省略 dbType 会让「重新取数」与 dbx_query_full
 * 在每条可分页 SQL 上 100% 失败，而门控的真实库用例在无本地数据库的机器上会跳过，
 * 所以这里用桩引擎把「方言一定随请求发出」这条契约锁住，不起真实引擎、不连数据库。
 * 真实连接上的端到端验证在 bi-live-postgres.test.js（门控）。
 *
 * 运行：npm test（脚本已带 --import ./src/test/support/dom-setup.mjs）。
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { bindEngineServices } from "../shared/services/engine-client.ts";
import { executeServerPage } from "../shared/services/execute-server-page.ts";

const CONNECTION = "pg-probe";

function okEnvelope(data) {
	return { ok: true, status: 200, statusText: "OK", headers: {}, body: { ok: true, data } };
}

/**
 * 桩引擎：记下每次 /connections 与 /query 的请求，并按请求的 page.limit 造出满块数据，
 * 让分块循环真的走下去（返回不足一块会被当成到底而提前跳出）。
 */
function stubEngine({ listFails = false } = {}) {
	const lists = [];
	const queries = [];
	const connections = [
		{ id: "c1", name: CONNECTION, type: "postgres", host: "127.0.0.1", port: 5432, database: "postgres", groupPath: "" },
	];
	return {
		lists,
		queries,
		request: async (_serviceId, request) => {
			if (request.path === "/connections") {
				lists.push(request.method);
				if (listFails) throw new Error("engine offline");
				return okEnvelope({ connections });
			}
			if (request.path === "/query") {
				queries.push(request.body);
				const limit = request.body?.page?.limit ?? 0;
				return okEnvelope({
					connection: CONNECTION,
					kind: "read",
					statement_count: 1,
					statements: [],
					truncated: false,
					pageable: true,
					paged: true,
					row_limit: limit,
					max_rows: limit,
					timeout_ms: 1000,
					duration_ms: 1,
					columns: ["region"],
					rows: Array.from({ length: limit }, (_, index) => ({ region: `r${index}` })),
					row_count: limit,
					affected_rows: 0,
				});
			}
			throw new Error(`unexpected engine path: ${request.path}`);
		},
	};
}

describe("executeServerPage — 方言回查", () => {
	after(() => bindEngineServices(null));

	it("调用方没给 dbType 时按连接名回查，并把方言透传给每一次分页查询", async () => {
		const engine = stubEngine();
		bindEngineServices({ request: engine.request });

		const outcome = await executeServerPage(CONNECTION, "select region from orders", {
			baseOffset: 0,
			pageSize: 2000,
			timeoutMs: 1000,
		});

		assert.ok(engine.lists.length >= 1, "缺省 dbType 时应回查引擎连接表");
		assert.ok(engine.queries.length >= 1, "回查后应该照常发出查询");
		for (const body of engine.queries) {
			assert.equal(body.dbType, "postgres", "每次分页查询都要带方言，否则引擎会拒绝分页");
		}
		assert.equal(outcome.rows.length, 2000, "分块拼页应凑满请求的 pageSize");
	});

	it("调用方已经给出 dbType 时不再回查，且原样透传", async () => {
		const engine = stubEngine();
		bindEngineServices({ request: engine.request });

		await executeServerPage(CONNECTION, "select 1", {
			baseOffset: 0,
			pageSize: 10,
			timeoutMs: 1000,
			dbType: "mysql",
		});

		assert.equal(engine.lists.length, 0, "调用方给了方言就不该多打一次 /connections");
		assert.equal(engine.queries[0].dbType, "mysql");
	});

	it("回查失败不吞掉请求：照常发出，让引擎给出真实错误", async () => {
		const engine = stubEngine({ listFails: true });
		bindEngineServices({ request: engine.request });

		const outcome = await executeServerPage(CONNECTION, "select 1", {
			baseOffset: 0,
			pageSize: 10,
			timeoutMs: 1000,
		});

		assert.equal(engine.queries.length, 1);
		assert.equal("dbType" in engine.queries[0], false, "回查不到方言时不要填假方言");
		assert.equal(outcome.rows.length, 10);
	});
});
