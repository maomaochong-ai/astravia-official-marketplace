/**
 * 「API 接入」单测（纯函数 + 临时目录，不需要引擎二进制、不需要网络）。
 *
 * 覆盖四条最容易出错、也最值得冻结的边界：
 * - 认证头组装（凭据只在这一步进请求头，绝不进持久化/回传）；
 * - 数据路径抽行（抽不到要报错，不能静默空表）；
 * - SQL 表名重写（字符串/注释/引号里的同名 token 不能被误改）；
 * - 本地存储合并与删除（文件损坏时不能把连接列表一起弄挂）。
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
	ApiSourceError,
	buildAuthHeaders,
	buildRequestHeaders,
	extractRecords,
	inferColumnTypes,
	isApiDbType,
	normalizeApiSource,
	normalizeDataPath,
	normalizeHeaders,
	snapshotFileName,
	tableFromRecords,
	toNdjson,
} from "../src/api-source/api-source.mjs";
import { fetchApiSource } from "../src/api-source/api-fetch.mjs";
import {
	API_ENGINE_CONNECTION,
	API_ENGINE_DATABASE,
	apiEngineDatabasePath,
	apiSourceToConnection,
	findApiSource,
	listApiSources,
	removeApiSource,
	upsertApiSource,
} from "../src/api-source/api-store.mjs";
import { findTableRefs, rewriteApiTableRefs, tokenize } from "../src/api-source/sql-rewrite.mjs";
import { runApiQuery } from "../src/api-source/api-query.mjs";

const tempDirs = [];
function makeTempDir() {
	const dir = mkdtempSync(join(tmpdir(), "dbx-api-source-"));
	tempDirs.push(dir);
	return dir;
}
after(() => {
	for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("isApiDbType", () => {
	it("只认 api，且大小写/空白容错", () => {
		assert.equal(isApiDbType("api"), true);
		assert.equal(isApiDbType(" API "), true);
		assert.equal(isApiDbType("postgres"), false);
		assert.equal(isApiDbType(undefined), false);
	});
});

describe("normalizeApiSource", () => {
	const base = { name: "posts", url: "https://api.example.com/v1/posts" };

	it("补默认值：GET、无认证、空数据路径、默认行数上限", () => {
		const config = normalizeApiSource(base);
		assert.equal(config.method, "GET");
		assert.equal(config.auth.kind, "none");
		assert.equal(config.dataPath, "");
		assert.equal(config.rowLimit, 1000);
		assert.deepEqual(config.headers, {});
	});

	it("拒绝非法 URL 协议与空名称", () => {
		assert.throws(() => normalizeApiSource({ ...base, url: "example.com/api" }), /不是合法 URL|合法 URL/);
		assert.throws(() => normalizeApiSource({ ...base, url: "ftp://example.com/x" }), /http/);
		assert.throws(() => normalizeApiSource({ name: "", url: base.url }), /名称不能为空/);
	});

	it("保留内网 http 地址（ADR §4.2 决策 3）", () => {
		const config = normalizeApiSource({ ...base, url: "http://10.0.0.7:8080/api/rows" });
		assert.equal(config.url, "http://10.0.0.7:8080/api/rows");
	});

	it("第一版只接受 GET", () => {
		assert.throws(() => normalizeApiSource({ ...base, method: "POST" }), /只支持 GET/);
		assert.equal(normalizeApiSource({ ...base, method: "get" }).method, "GET");
	});

	it("行数上限受引擎 1000 行上限约束", () => {
		assert.throws(() => normalizeApiSource({ ...base, rowLimit: 0 }), /行数上限/);
		assert.throws(() => normalizeApiSource({ ...base, rowLimit: 5000 }), /行数上限/);
		assert.equal(normalizeApiSource({ ...base, rowLimit: 200 }).rowLimit, 200);
	});

	it("认证配置归一化，且不带出凭据", () => {
		const bearer = normalizeApiSource({ ...base, auth: { kind: "bearer" }, token: "t" });
		assert.deepEqual(bearer.auth, { kind: "bearer" });
		assert.equal("token" in bearer, false);
		assert.equal("secret" in bearer, false);

		const apiKey = normalizeApiSource({ ...base, auth: { kind: "api-key", headerName: "X-Token", prefix: "Token" } });
		assert.deepEqual(apiKey.auth, { kind: "api-key", headerName: "X-Token", prefix: "Token" });

		const basic = normalizeApiSource({ ...base, auth: { kind: "basic", username: "alice" } });
		assert.deepEqual(basic.auth, { kind: "basic", username: "alice" });

		assert.throws(() => normalizeApiSource({ ...base, auth: { kind: "oauth2" } }), /不支持的认证方式/);
		assert.throws(() => normalizeApiSource({ ...base, auth: { kind: "basic" } }), /需要用户名/);
		assert.throws(() => normalizeApiSource({ ...base, auth: { kind: "api-key", headerName: "bad name" } }), /不合法/);
	});
});

describe("normalizeHeaders", () => {
	it("解析 `key: value` 文本行，忽略空行与 # 注释", () => {
		assert.deepEqual(normalizeHeaders("X-A: 1\n\n# 注释\nX-B:2"), { "X-A": "1", "X-B": "2" });
	});

	it("值里可以有冒号", () => {
		assert.deepEqual(normalizeHeaders(["Referer: https://a/b"]), { Referer: "https://a/b" });
	});

	it("缺冒号直接报错，而不是静默丢掉", () => {
		assert.throws(() => normalizeHeaders("Authorization Bearer x"), /缺少冒号/);
	});
});

describe("buildAuthHeaders", () => {
	it("bearer / api-key / basic / none", () => {
		assert.deepEqual(buildAuthHeaders({ kind: "bearer" }, "T"), { Authorization: "Bearer T" });
		assert.deepEqual(buildAuthHeaders({ kind: "api-key", headerName: "X-Key" }, "K"), { "X-Key": "K" });
		assert.deepEqual(buildAuthHeaders({ kind: "api-key" }, "K"), { "X-API-Key": "K" });
		assert.deepEqual(buildAuthHeaders({ kind: "api-key", headerName: "X-Key", prefix: "Token" }, "K"), {
			"X-Key": "Token K",
		});
		assert.deepEqual(buildAuthHeaders({ kind: "basic", username: "alice" }, "pw"), {
			Authorization: `Basic ${Buffer.from("alice:pw").toString("base64")}`,
		});
		assert.deepEqual(buildAuthHeaders({ kind: "none" }, ""), {});
	});

	it("需要凭据但没给 → AUTH_MISSING，而不是发出一个匿名请求", () => {
		assert.throws(() => buildAuthHeaders({ kind: "bearer" }, ""), (error) => error.code === "AUTH_MISSING");
	});

	it("认证头覆盖用户自定义同名头（自定义头不能把认证写坏）", () => {
		const headers = buildRequestHeaders(
			{ headers: { Authorization: "Bearer wrong", "X-Extra": "1" }, auth: { kind: "bearer" } },
			"right",
		);
		assert.equal(headers.Authorization, "Bearer right");
		assert.equal(headers["X-Extra"], "1");
		assert.equal(headers.Accept, "application/json");
	});
});

describe("normalizeDataPath / parseDataPath", () => {
	it("支持点路径与下标", () => {
		assert.equal(normalizeDataPath(" data.items "), "data.items");
		assert.equal(normalizeDataPath(".data.items"), "data.items");
		assert.equal(normalizeDataPath(""), "");
		assert.throws(() => normalizeDataPath("data[items]"), /不合法/);
		assert.throws(() => normalizeDataPath("data..items"), /不合法/);
	});
});

describe("extractRecords", () => {
	it("空路径 = 响应本身就是数组", () => {
		assert.deepEqual(extractRecords([{ id: 1 }], ""), [{ id: 1 }]);
	});

	it("按点路径与下标下钻", () => {
		const payload = { data: { list: [{ items: [1, 2] }] } };
		assert.deepEqual(extractRecords(payload, "data.list[0].items"), [1, 2]);
	});

	it("抽不到数组时报错，并列出响应顶层键", () => {
		assert.throws(
			() => extractRecords({ result: { rows: [] } }, "data.items"),
			(error) => error.code === "API_PATH_NOT_FOUND" && error.message.includes("result"),
		);
		assert.throws(
			() => extractRecords({ data: { total: 3 } }, "data.items"),
			(error) => error.code === "API_PATH_NOT_FOUND",
		);
		assert.throws(
			() => extractRecords(null, ""),
			(error) => error.code === "API_PATH_NOT_FOUND",
		);
	});

	it("抽到空数组是合法结果", () => {
		assert.deepEqual(extractRecords({ data: { items: [] } }, "data.items"), []);
	});
});

describe("tableFromRecords", () => {
	it("列取键的并集，保持首次出现顺序", () => {
		const table = tableFromRecords([{ a: 1, b: 2 }, { b: 3, c: 4 }], { rowLimit: 100 });
		assert.deepEqual(table.columns, ["a", "b", "c"]);
		assert.deepEqual(table.rows[1], { a: null, b: 3, c: 4 });
	});

	it("嵌套对象序列化成 JSON 字符串", () => {
		const table = tableFromRecords([{ id: 1, meta: { k: "v" } }], { rowLimit: 100 });
		assert.equal(table.rows[0].meta, '{"k":"v"}');
	});

	it("超过行数上限时标记 truncated", () => {
		const table = tableFromRecords([{ a: 1 }, { a: 2 }, { a: 3 }], { rowLimit: 2 });
		assert.equal(table.rows.length, 2);
		assert.equal(table.truncated, true);
		assert.equal(table.totalRecords, 3);
	});

	it("裸标量数组退化成单列 value，而不是零列表", () => {
		const table = tableFromRecords([1, 2], { rowLimit: 10 });
		assert.deepEqual(table.columns, ["value"]);
		assert.deepEqual(table.rows, [{ value: 1 }, { value: 2 }]);
	});
});

describe("toNdjson / snapshotFileName", () => {
	it("行 → NDJSON，空结果给空串", () => {
		assert.equal(toNdjson([{ a: 1 }, { a: 2 }]), '{"a":1}\n{"a":2}\n');
		assert.equal(toNdjson([]), "");
	});

	it("文件名只保留安全字符，挡住路径逃逸", () => {
		assert.equal(snapshotFileName("posts"), "posts.ndjson");
		assert.equal(snapshotFileName("../../etc/passwd"), "etc_passwd.ndjson");
		// 纯中文名清洗后为空，退化成哈希名：不能因为起了中文名就用不了
		assert.match(snapshotFileName("订单 同步"), /^src-[0-9a-f]{12}\.ndjson$/);
		assert.equal(snapshotFileName("订单 同步"), snapshotFileName("订单 同步"));
		assert.throws(() => snapshotFileName("   "), /名称不能为空/);
	});
});

describe("api-store 持久化", () => {
	it("新增 / 读取 / 覆盖 / 删除，凭据不出现在连接摘要里", () => {
		const dataDir = makeTempDir();
		const saved = upsertApiSource(
			dataDir,
			{ name: "posts", url: "https://api.example.com/posts", auth: { kind: "bearer" }, dataPath: "data.items" },
			"TOKEN-1",
		);
		assert.equal(saved.secret, "TOKEN-1");

		const list = listApiSources(dataDir);
		assert.equal(list.length, 1);
		assert.equal(findApiSource(dataDir, "POSTS").url, "https://api.example.com/posts");

		const summary = apiSourceToConnection(list[0]);
		assert.equal(summary.type, "api");
		assert.equal(summary.name, "posts");
		assert.equal(summary.host, "api.example.com");
		assert.equal(summary.read_only, true);
		assert.equal(JSON.stringify(summary).includes("TOKEN-1"), false);

		// 编辑配置不重输 token：沿用旧凭据
		const updated = upsertApiSource(dataDir, { name: "posts", url: "https://api.example.com/v2/posts" }, "");
		assert.equal(updated.secret, "TOKEN-1");
		assert.equal(updated.createdAt, saved.createdAt);
		assert.equal(listApiSources(dataDir).length, 1);

		removeApiSource(dataDir, "posts");
		assert.equal(listApiSources(dataDir).length, 0);
		assert.throws(() => removeApiSource(dataDir, "posts"), (error) => error.code === "CONNECTION_NOT_FOUND");
	});

	it("文件 0600，且存储文件里不出现明文以外的额外字段", () => {
		const dataDir = makeTempDir();
		upsertApiSource(dataDir, { name: "p", url: "http://127.0.0.1:8080/x" }, "");
		const mode = statSync(join(dataDir, "api-connections.json")).mode & 0o777;
		assert.equal(mode, 0o600);
	});

	it("请求头缺省时沿用已存值，显式传空对象才清空", () => {
		const dataDir = makeTempDir();
		upsertApiSource(
			dataDir,
			{
				name: "posts",
				url: "https://api.example.com/posts",
				headers: { "X-Env": "prod", "Accept-Language": "zh-CN" },
			},
			"",
		);

		// 客户端从不收到 headers（值里可能藏凭据），所以表单那个框天然是空的：
		// 改个行数再保存不能把请求头静默清掉。
		const kept = upsertApiSource(
			dataDir,
			{ name: "posts", url: "https://api.example.com/posts", rowLimit: 50 },
			"",
		);
		assert.deepEqual(kept.headers, { "X-Env": "prod", "Accept-Language": "zh-CN" });
		assert.equal(kept.rowLimit, 50);

		// 显式传（含空对象）才覆盖。
		const replaced = upsertApiSource(
			dataDir,
			{ name: "posts", url: "https://api.example.com/posts", headers: { "X-Env": "dev" } },
			"",
		);
		assert.deepEqual(replaced.headers, { "X-Env": "dev" });

		const cleared = upsertApiSource(
			dataDir,
			{ name: "posts", url: "https://api.example.com/posts", headers: {} },
			"",
		);
		assert.deepEqual(cleared.headers, {});
	});

	it("连接摘要只告知有没有请求头，不回传内容", () => {
		const dataDir = makeTempDir();
		const saved = upsertApiSource(
			dataDir,
			{ name: "posts", url: "https://api.example.com/posts", headers: { "X-Env": "prod" } },
			"",
		);
		const summary = apiSourceToConnection(saved);
		assert.equal(summary.api.hasHeaders, true);
		assert.equal(JSON.stringify(summary).includes("prod"), false);

		const bare = upsertApiSource(dataDir, { name: "plain", url: "https://api.example.com/plain" }, "");
		assert.equal(apiSourceToConnection(bare).api.hasHeaders, false);
	});

	it("需要凭据却没给 → AUTH_MISSING，不写入半成品", () => {
		const dataDir = makeTempDir();
		assert.throws(
			() => upsertApiSource(dataDir, { name: "p", url: "http://127.0.0.1:8080/x", auth: { kind: "bearer" } }, ""),
			(error) => error.code === "AUTH_MISSING",
		);
		assert.equal(listApiSources(dataDir).length, 0);
	});

	it("存储文件损坏时返回空列表，而不是让连接列表整体失败", () => {
		const dataDir = makeTempDir();
		writeFileSync(join(dataDir, "api-connections.json"), "{ not json");
		assert.deepEqual(listApiSources(dataDir), []);
	});
});

describe("sql-rewrite", () => {
	const paths = new Map([["posts", "/tmp/api-cache/posts.ndjson"]]);

	it("FROM 位置的表名 → read_json_auto + 原名别名", () => {
		const out = rewriteApiTableRefs("select * from posts limit 10", paths);
		assert.equal(out.sql, "select * from read_json_auto('/tmp/api-cache/posts.ndjson') AS \"posts\" limit 10");
		assert.deepEqual(out.replaced, ["posts"]);
	});

	it("限定引用不用改：别名让 posts.id 继续有效", () => {
		const out = rewriteApiTableRefs("select posts.id from posts where posts.id = 1", paths);
		assert.ok(out.sql.includes('where posts.id = 1'));
		assert.equal(out.sql.split("read_json_auto").length - 1, 1);
	});

	it("用户自己写了别名时不重复加 AS", () => {
		const out = rewriteApiTableRefs("select p.id from posts p", paths);
		assert.equal(out.sql, "select p.id from read_json_auto('/tmp/api-cache/posts.ndjson') p");
	});

	it("JOIN 与 FROM 列表里的逗号都算表位置", () => {
		const two = new Map([...paths, ["dim_region", "/tmp/api-cache/dim.ndjson"]]);
		const out = rewriteApiTableRefs("select * from posts, dim_region", two);
		assert.deepEqual(out.replaced.sort(), ["dim_region", "posts"]);
		const joined = rewriteApiTableRefs("select * from posts left join dim_region on true", two);
		assert.deepEqual(joined.replaced.sort(), ["dim_region", "posts"]);
	});

	it("字符串 / 注释 / 引号标识符里的同名 token 不动", () => {
		const sql = "select 'from posts' as note -- from posts\n/* posts */ from posts";
		const out = rewriteApiTableRefs(sql, paths);
		assert.ok(out.sql.startsWith("select 'from posts' as note -- from posts\n/* posts */ from read_json_auto"));
		assert.equal(out.sql.split("read_json_auto").length - 1, 1);
	});

	it("只碰配置过的数据源名", () => {
		const out = rewriteApiTableRefs("select * from real_table", paths);
		assert.equal(out.changed, false);
		assert.equal(out.sql, "select * from real_table");
	});

	it("referenced 判断包含非表位置的出现（决定要不要取数）", () => {
		const out = rewriteApiTableRefs("select 1 from others", paths, { names: ["posts"] });
		assert.deepEqual(out.referenced, []);
		const hit = rewriteApiTableRefs("select * from posts", paths, { names: ["posts", "dims"] });
		assert.deepEqual(hit.referenced, ["posts"]);
	});

	it("词法扫描把注释/字符串当整体，表位置只在 FROM/JOIN 之后", () => {
		const tokens = tokenize("select a from t");
		const refs = findTableRefs(tokens);
		assert.equal(refs.length, 1);
		assert.equal(tokens[refs[0].index].text, "t");
	});

	it("从 read_json_auto(...) 读快照的结果能被子查询里的 FROM 引用", () => {
		const out = rewriteApiTableRefs("select count(*) from (select * from posts) x", paths);
		assert.ok(out.sql.includes("from (select * from read_json_auto"));
	});

	it("中文名裸写也算标识符（不加双引号也能重写）", () => {
		const cjk = new Map([["订单", "/tmp/api-cache/src-abc.ndjson"]]);
		const out = rewriteApiTableRefs("select * from 订单", cjk);
		assert.equal(out.changed, true);
		assert.equal(out.sql, "select * from read_json_auto('/tmp/api-cache/src-abc.ndjson') AS \"订单\"");
	});
});

describe("fetchApiSource", () => {
	const config = normalizeApiSource({
		name: "posts",
		url: "http://127.0.0.1:8787/api/v1/posts",
		auth: { kind: "bearer" },
		dataPath: "data.items",
	});

	it("带上认证头，按数据路径抽行并表格化", async () => {
		let seen = null;
		const fetchImpl = async (url, init) => {
			seen = { url, init };
			return new Response(JSON.stringify({ data: { items: [{ id: 1 }, { id: 2 }] } }), { status: 200 });
		};
		const result = await fetchApiSource({ ...config, secret: "T" }, { fetchImpl });
		assert.equal(seen.init.headers.Authorization, "Bearer T");
		assert.equal(result.table.columns.join(","), "id");
		assert.equal(result.table.rows.length, 2);
		assert.equal(result.status, 200);
	});

	it("401 → AUTH_FAILED（不是「查成功了但没数据」）", async () => {
		const fetchImpl = async () => new Response("<html>unauthorized</html>", { status: 401 });
		await assert.rejects(
			() => fetchApiSource({ ...config, secret: "bad" }, { fetchImpl }),
			(error) => error.code === "AUTH_FAILED",
		);
	});

	it("5xx 也当错误，且附响应片段", async () => {
		const fetchImpl = async () => new Response("boom", { status: 500 });
		await assert.rejects(
			() => fetchApiSource({ ...config, secret: "T" }, { fetchImpl }),
			(error) => error.code === "API_HTTP_ERROR" && error.message.includes("500"),
		);
	});

	it("非 JSON 响应 → API_INVALID_JSON", async () => {
		const fetchImpl = async () => new Response("<html>ok</html>", { status: 200 });
		await assert.rejects(
			() => fetchApiSource({ ...config, secret: "T" }, { fetchImpl }),
			(error) => error.code === "API_INVALID_JSON",
		);
	});

	it("网络失败 → CONNECTION_FAILED", async () => {
		const fetchImpl = async () => {
			throw new Error("ECONNREFUSED");
		};
		await assert.rejects(
			() => fetchApiSource({ ...config, secret: "T" }, { fetchImpl }),
			(error) => error.code === "CONNECTION_FAILED",
		);
	});

	it("超时 → TIMEOUT", async () => {
		const fetchImpl = async (_url, init) =>
			new Promise((_resolve, reject) => {
				init.signal.addEventListener("abort", () => {
					const error = new Error("aborted");
					error.name = "AbortError";
					reject(error);
				});
			});
		await assert.rejects(
			() => fetchApiSource({ ...config, secret: "T" }, { fetchImpl, timeoutMs: 20 }),
			(error) => error.code === "TIMEOUT",
		);
	});
});

describe("runApiQuery", () => {
	function fakeEngine() {
		const calls = { ensure: 0, sql: [] };
		return {
			calls,
			ensureConnection: async () => {
				calls.ensure += 1;
			},
			execute: async (sql) => {
				calls.sql.push(sql);
				return "engine-text";
			},
		};
	}

	function seed(dataDir) {
		upsertApiSource(
			dataDir,
			{ name: "posts", url: "http://127.0.0.1:8787/api/v1/posts", dataPath: "data.items" },
			"",
		);
	}

	it("取数 → 物化 → 重写 → 交引擎，并回报取数摘要", async () => {
		const dataDir = makeTempDir();
		seed(dataDir);
		const engine = fakeEngine();
		const fetchImpl = async () =>
			new Response(JSON.stringify({ data: { items: [{ id: 1, title: "a" }] } }), { status: 200 });

		const result = await runApiQuery({
			dataDir,
			sql: "select id from posts where id = 1",
			maxRows: 50,
			engine,
			fetchImpl,
		});

		assert.equal(engine.calls.ensure, 1);
		assert.equal(engine.calls.sql.length, 1);
		assert.ok(engine.calls.sql[0].startsWith("select id from read_json_auto('"));
		assert.equal(result.engineText, "engine-text");
		assert.equal(result.sources.length, 1);
		assert.equal(result.sources[0].rowCount, 1);
		assert.deepEqual(result.sources[0].columns, ["id", "title"]);
		assert.equal(result.sources[0].fetchedAt.length > 0, true);

		// 物化文件真的落盘了，且是 NDJSON
		const ndjson = readFileSync(result.sources[0].path, "utf8");
		assert.equal(ndjson, '{"id":1,"title":"a"}\n');
	});

	it("快照 0600 落盘，删除连接后不留在磁盘上", async () => {
		const dataDir = makeTempDir();
		seed(dataDir);
		const fetchImpl = async () => new Response(JSON.stringify({ data: { items: [{ id: 1 }] } }), { status: 200 });
		const result = await runApiQuery({ dataDir, sql: "select * from posts", engine: fakeEngine(), fetchImpl });
		assert.equal(statSync(result.sources[0].path).mode & 0o777, 0o600);

		removeApiSource(dataDir, "posts");
		assert.equal(existsSync(result.sources[0].path), false, "删除连接后快照应一并清掉");

		// 纯中文名走 `src-<哈希>` 的兜底文件名，删除时用同一个路径函数，同样要清掉
		upsertApiSource(dataDir, { name: "订单", url: "http://127.0.0.1:8787/x", dataPath: "data.items" }, "");
		const cjk = await runApiQuery({ dataDir, sql: "select * from 订单", engine: fakeEngine(), fetchImpl });
		removeApiSource(dataDir, "订单");
		assert.equal(existsSync(cjk.sources[0].path), false);
	});

	it("SQL 没引用任何数据源 → 明确报错，不去打扰接口", async () => {
		const dataDir = makeTempDir();
		seed(dataDir);
		let fetched = 0;
		const fetchImpl = async () => {
			fetched += 1;
			return new Response("[]", { status: 200 });
		};
		await assert.rejects(
			() => runApiQuery({ dataDir, sql: "select 1", engine: fakeEngine(), fetchImpl }),
			(error) => error.code === "API_SOURCE_NOT_REFERENCED",
		);
		assert.equal(fetched, 0);
	});

	it("没有配置任何连接 → CONNECTION_NOT_FOUND", async () => {
		await assert.rejects(
			() => runApiQuery({ dataDir: makeTempDir(), sql: "select 1", engine: fakeEngine() }),
			(error) => error.code === "CONNECTION_NOT_FOUND",
		);
	});

	it("取数失败时抛出，不把空表交给引擎（静默空表是错误体验）", async () => {
		const dataDir = makeTempDir();
		seed(dataDir);
		const fetchImpl = async () => new Response("{}", { status: 200 });
		await assert.rejects(
			() => runApiQuery({ dataDir, sql: "select * from posts", engine: fakeEngine(), fetchImpl }),
			(error) => error instanceof ApiSourceError && error.code === "API_PATH_NOT_FOUND",
		);
	});

	it("接口返回 0 行时仍然是合法查询，引擎收到的是空快照", async () => {
		const dataDir = makeTempDir();
		seed(dataDir);
		const engine = fakeEngine();
		const fetchImpl = async () => new Response(JSON.stringify({ data: { items: [] } }), { status: 200 });
		const result = await runApiQuery({ dataDir, sql: "select * from posts", engine, fetchImpl });
		assert.equal(result.sources[0].rowCount, 0);
		assert.equal(readFileSync(result.sources[0].path, "utf8"), "");
	});
});
// 这一条是端到端跑出来的回归：引擎把连接配置里的 `database` 当作 DuckDB 的 catalog 名，
// 而 catalog 名就是库文件的 basename。两者不一致时查询报
// `Catalog Error: SET schema: No catalog + schema named "api" found.`，
// 而单测全部绿 —— 所以把不变量钉在这里。
describe("内部查询连接", () => {
	it("database 名必须等于 DuckDB 库文件的 basename", () => {
		const dataDir = makeTempDir();
		const file = apiEngineDatabasePath(dataDir).split("/").pop();
		assert.equal(file, `${API_ENGINE_DATABASE}.duckdb`);
	});

	it("内部连接名带 __ 前缀，UI 据此从连接树里隐藏", () => {
		assert.match(API_ENGINE_CONNECTION, /^__/);
	});
});

// 连接树「结构」视图的类型标注：只根据样本值给粗粒度标签，不能把混合类型说成数字。
describe("inferColumnTypes", () => {
	it("整数 / 小数 / 布尔 / 嵌套对象各自标注", () => {
		const types = inferColumnTypes(
			[{ id: 1, ratio: 0.5, ok: true, meta: { a: 1 }, name: "x" }],
			["id", "ratio", "ok", "meta", "name"],
		);
		assert.deepEqual(types, {
			id: "bigint",
			ratio: "double",
			ok: "boolean",
			meta: "json",
			name: "varchar",
		});
	});

	it("整数与小数混在同一列归 double", () => {
		assert.deepEqual(inferColumnTypes([{ n: 1 }, { n: 2.5 }], ["n"]), { n: "double" });
	});

	it("数字与文本混在同一列（或整列为 null）回 varchar", () => {
		assert.deepEqual(inferColumnTypes([{ v: 1 }, { v: "a" }], ["v"]), { v: "varchar" });
		assert.deepEqual(inferColumnTypes([{ v: null }, {}], ["v"]), { v: "varchar" });
	});
});
