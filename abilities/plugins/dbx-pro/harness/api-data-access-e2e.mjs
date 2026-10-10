/**
 * 「API 接入」端到端验证（M2 验收证据的可复现脚本）。
 *
 * 走的是插件自己的 HTTP 服务（server/src/http-server.mjs），也就是 UI 真正调用的那一层
 * —— 不是单元测试里的桩。数据目录隔离在临时目录，绝不碰用户的真实 DBX_DATA_DIR。
 *
 * 用法（两个终端）：
 *   node harness/api-data-access-mock-api.mjs
 *   DBX_DUCKDB_DRIVER_PATH=<duckdb 驱动目录> node harness/api-data-access-e2e.mjs
 *
 * `/query` 需要引擎的 DuckDB 驱动；不设 `DBX_DUCKDB_DRIVER_PATH` 时 `/query` 会返回 501
 * （接口数据已取到，只是没地方跑 SQL），属环境缺失而非功能回归。
 * 环境变量：MOCK_PORT / MOCK_TOKEN 与 mock 脚本保持一致；MOCK_URL 可直接覆盖接口地址。
 */
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { createEngineServer } = await import(resolve(REPO, "server/src/http-server.mjs"));
const { disposeDbxMcpClient } = await import(resolve(REPO, "server/src/engine/dbx-mcp-client.mjs"));

const dataDir = mkdtempSync(join(tmpdir(), "api-e2e-data-"));
const TOKEN = "e2e-token";
const MOCK_TOKEN = process.env.MOCK_TOKEN ?? "secret-token-123";
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 8787);
const MOCK_URL = process.env.MOCK_URL ?? `http://127.0.0.1:${MOCK_PORT}/api/v1/posts`;

const { server, ready } = createEngineServer({ token: TOKEN, dataDir });

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`engine server on ${base}\ndataDir=${dataDir}\n`);

async function call(method, pathname, body) {
	const res = await fetch(`${base}${pathname}`, {
		method,
		headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = await res.json().catch(() => null);
	return { status: res.status, json };
}

const results = [];
function check(label, ok, detail) {
	results.push({ label, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

// 0) 引擎客户端就绪（内部 DuckDB 连接要能登记）
await ready;

// 1) 建一个 API 接入连接
const created = await call("POST", "/api-sources", {
	name: "posts",
	url: MOCK_URL,
	method: "GET",
	auth: { kind: "bearer" },
	token: MOCK_TOKEN,
	dataPath: "data.items",
	rowLimit: 1000,
});
check(
	"POST /api-sources 建连接",
	created.status === 200 && created.json?.data?.name === "posts",
	`status=${created.status} type=${created.json?.data?.type}`,
);
check(
	"响应里不含明文凭据",
	!JSON.stringify(created.json).includes(MOCK_TOKEN),
	`hasSecret=${created.json?.data?.api?.hasSecret}`,
);
check("连接被标记为只读", created.json?.data?.read_only === true);

// 2) 存储落盘 + 0600
const storePath = join(dataDir, "api-connections.json");
const storeMode = statSync(storePath).mode & 0o777;
const storeRaw = readFileSync(storePath, "utf8");
check("配置落在插件本地（api-connections.json）", storeRaw.includes("data.items"));
check("文件权限 0600", storeMode === 0o600, storeMode.toString(8));
check("凭据确实存在文件里（服务端单一份）", storeRaw.includes(MOCK_TOKEN));

// 3) 未带认证头 → /api-sources/test 报 401
const badAuth = await call("POST", "/api-sources/test", {
	draft: {
		name: "tmp-bad",
		url: MOCK_URL,
		method: "GET",
		auth: { kind: "bearer" },
		dataPath: "data.items",
	},
	token: "wrong-token",
});
check(
	"错凭据 → AUTH_FAILED(401)",
	badAuth.status === 401 && badAuth.json?.error?.code === "AUTH_FAILED",
	`status=${badAuth.status} code=${badAuth.json?.error?.code}`,
);

// 4) 正确凭据 → 测试取数返回列与样例
const goodAuth = await call("POST", "/api-sources/test", {
	draft: { name: "posts", url: MOCK_URL, method: "GET", auth: { kind: "bearer" }, dataPath: "data.items" },
	token: MOCK_TOKEN,
});
check(
	"对凭据 → 测试取数返回列",
	goodAuth.status === 200 && goodAuth.json?.data?.columns?.includes("title"),
	`status=${goodAuth.status} columns=${JSON.stringify(goodAuth.json?.data?.columns)}`,
);

// 5) /connections 合并出 api 连接，且隐藏内部连接
const conns = await call("GET", "/connections");
const names = (conns.json?.data?.connections ?? []).map((c) => c.name);
check("GET /connections 含 api 连接", names.includes("posts"), names.join(","));
check("内部 __dbx_pro_api__ 不出现在连接列表", !names.includes("__dbx_pro_api__"));

// 6) 用连接名命中路径 0：最简单的一条查询
const q1 = await call("POST", "/query", { connectionName: "posts", sql: "select * from posts" });
const rows1 = q1.json?.data?.rows ?? [];
check(
	"POST /query  select * from posts",
	q1.status === 200 && rows1.length === 7,
	`status=${q1.status} rows=${rows1.length} cols=${JSON.stringify(q1.json?.data?.columns)}`,
);
check("嵌套字段被序列化成一列", typeof rows1[0]?.author === "string", String(rows1[0]?.author));
check("结果里带取数来源信息", q1.json?.data?.api?.sources?.[0]?.url === MOCK_URL);

// 7) 带别名 / 限定名 + 聚合 + WHERE
const q2 = await call("POST", "/query", {
	connectionName: "posts",
	sql: "select p.id, p.title from posts as p where p.id = 2",
});
check(
	"限定名 + 别名",
	q2.status === 200 && q2.json?.data?.rows?.[0]?.title === "文章 2",
	`status=${q2.status} row=${JSON.stringify(q2.json?.data?.rows?.[0])}`,
);

const q3 = await call("POST", "/query", {
	connectionName: "posts",
	sql: "select count(*) as n, sum(amount) as total from posts where amount >= 30",
});
check(
	"聚合 / WHERE 在快照上生效",
	q3.status === 200 && Number(q3.json?.data?.rows?.[0]?.n) === 5,
	`status=${q3.status} row=${JSON.stringify(q3.json?.data?.rows?.[0])}`,
);
console.log(`      引擎实际执行的 SQL: ${q3.json?.data?.api?.engine_sql}`);

// 8) 写 / DDL 必须被拒
const w1 = await call("POST", "/query", {
	connectionName: "posts",
	sql: "drop table posts",
	allowWrite: true,
	confirmedWriteSql: "drop table posts",
});
check(
	"写 / DDL → WRITE_BLOCKED(403)",
	w1.status === 403 && w1.json?.error?.code === "WRITE_BLOCKED",
	`status=${w1.status} code=${w1.json?.error?.code}`,
);

// 9) 引用了不存在的表名 → 只读数据源里找不到
const q4 = await call("POST", "/query", { connectionName: "posts", sql: "select * from nothing_here" });
check(
	"未引用任何 API 数据源 → API_SOURCE_NOT_REFERENCED(400)",
	q4.status === 400 && q4.json?.error?.code === "API_SOURCE_NOT_REFERENCED",
	`status=${q4.status} code=${q4.json?.error?.code} msg=${q4.json?.error?.message?.slice(0, 60)}`,
);

// 10) 重名保护：与引擎已有连接同名要拒绝（这里用内部连接名试探真实重名逻辑）
const clash = await call("POST", "/api-sources", {
	name: "__dbx_pro_api__",
	url: MOCK_URL,
	auth: { kind: "bearer" },
	token: MOCK_TOKEN,
	dataPath: "data.items",
});
check(
	"与已有连接同名 → BAD_REQUEST",
	clash.status === 400 && clash.json?.error?.code === "BAD_REQUEST",
	`status=${clash.status} msg=${clash.json?.error?.message?.slice(0, 40)}`,
);

// 11) 删除前先确认快照落到了 api-cache/ 下
const snapDir = join(dataDir, "api-cache");
const snapPath = join(snapDir, "posts.ndjson");
const snap = readFileSync(snapPath, "utf8").trim().split("\n");
check("NDJSON 快照已物化", snap.length === 7, `${snap.length} 行`);
check(
	"快照权限 0600",
	(statSync(snapPath).mode & 0o777) === 0o600,
	(statSync(snapPath).mode & 0o777).toString(8),
);

// 12) 删除：连接、凭据、明文快照都不留
const del = await call("DELETE", "/api-sources", { name: "posts" });
const after = await call("GET", "/connections");
check(
	"DELETE /api-sources 后连接列表里没有了",
	del.status === 200 && !(after.json?.data?.connections ?? []).some((c) => c.name === "posts"),
	`status=${del.status}`,
);
check("删除后明文快照不留在磁盘上", !existsSync(snapPath));
check(
	"删除后配置里也没有残留凭据",
	!readFileSync(join(dataDir, "api-connections.json"), "utf8").includes(MOCK_TOKEN),
);

console.log(
	`\n# 汇总: ${results.filter((r) => r.ok).length}/${results.length} 通过` +
		(results.some((r) => !r.ok) ? `；失败: ${results.filter((r) => !r.ok).map((r) => r.label).join(" / ")}` : ""),
);

server.close();
await disposeDbxMcpClient();
process.exit(results.every((r) => r.ok) ? 0 : 1);
