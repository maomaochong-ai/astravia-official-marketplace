/**
 * api-source.test.ts — API 数据源配置归一化、认证头组装、响应抽行。
 *
 * 测试 normalizeApiSource / normalizeDataPath / parseDataPath / normalizeHeaders /
 * normalizeAuth / buildAuthHeaders / extractRecords / tableFromRecords / toNdjson /
 * snapshotFileName / isApiDbType。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	isApiDbType,
	normalizeDataPath,
	parseDataPath,
	normalizeHeaders,
	normalizeAuth,
	normalizeApiSource,
	buildAuthHeaders,
	buildRequestHeaders,
	extractRecords,
	tableFromRecords,
	toNdjson,
	snapshotFileName,
	topLevelKeys,
	inferColumnTypes,
	ApiSourceError,
	API_DB_TYPE,
} from "../src/api/external/types.ts";

describe("api-source · isApiDbType", () => {
	it("识别 api 类型", () => {
		assert.equal(isApiDbType("api"), true);
		assert.equal(isApiDbType("API"), true);
		assert.equal(isApiDbType(" api "), true);
	});

	it("非 api 类型返回 false", () => {
		assert.equal(isApiDbType("mysql"), false);
		assert.equal(isApiDbType("postgres"), false);
		assert.equal(isApiDbType(""), false);
		assert.equal(isApiDbType(null), false);
		assert.equal(isApiDbType(undefined), false);
	});
});

describe("api-source · normalizeDataPath", () => {
	it("空路径返回空串", () => {
		assert.equal(normalizeDataPath(""), "");
		assert.equal(normalizeDataPath(null), "");
		assert.equal(normalizeDataPath(undefined), "");
	});

	it("合法路径原样返回", () => {
		assert.equal(normalizeDataPath("data"), "data");
		assert.equal(normalizeDataPath("data.list"), "data.list");
		assert.equal(normalizeDataPath("data.items[0]"), "data.items[0]");
	});

	it("去掉开头的点", () => {
		assert.equal(normalizeDataPath(".data.list"), "data.list");
	});

	it("非法路径抛错", () => {
		assert.throws(() => normalizeDataPath("data..list"), ApiSourceError);
		assert.throws(() => normalizeDataPath("data[abc]"), ApiSourceError);
		assert.throws(() => normalizeDataPath("data.list."), ApiSourceError);
	});
});

describe("api-source · parseDataPath", () => {
	it("空路径返回空数组", () => {
		assert.deepEqual(parseDataPath(""), []);
	});

	it("简单路径", () => {
		assert.deepEqual(parseDataPath("data"), ["data"]);
		assert.deepEqual(parseDataPath("data.list"), ["data", "list"]);
	});

	it("带下标", () => {
		assert.deepEqual(parseDataPath("data[0]"), ["data", 0]);
		assert.deepEqual(parseDataPath("data.list[2].items"), ["data", "list", 2, "items"]);
	});
});

describe("api-source · normalizeHeaders", () => {
	it("对象输入直接返回", () => {
		const headers = normalizeHeaders({ "X-Custom": "value", Accept: "application/json" });
		assert.deepEqual(headers, { "X-Custom": "value", Accept: "application/json" });
	});

	it("文本行输入解析 key: value", () => {
		const headers = normalizeHeaders("X-Custom: value\nAccept: application/json");
		assert.deepEqual(headers, { "X-Custom": "value", Accept: "application/json" });
	});

	it("数组输入按行解析", () => {
		const headers = normalizeHeaders(["X-Custom: value", "Accept: application/json"]);
		assert.deepEqual(headers, { "X-Custom": "value", Accept: "application/json" });
	});

	it("忽略空行和注释行", () => {
		const headers = normalizeHeaders("# comment\nX-Key: val\n\n# another");
		assert.deepEqual(headers, { "X-Key": "val" });
	});

	it("缺少冒号抛错", () => {
		assert.throws(() => normalizeHeaders("invalid header"), ApiSourceError);
	});
});

describe("api-source · normalizeAuth", () => {
	it("默认无认证", () => {
		const auth = normalizeAuth(null);
		assert.equal(auth.kind, "none");
	});

	it("bearer 认证", () => {
		const auth = normalizeAuth({ kind: "bearer" });
		assert.equal(auth.kind, "bearer");
	});

	it("api-key 认证", () => {
		const auth = normalizeAuth({ kind: "api-key", headerName: "X-API-Key" });
		assert.equal(auth.kind, "api-key");
		assert.equal(auth.headerName, "X-API-Key");
	});

	it("api-key 默认 headerName", () => {
		const auth = normalizeAuth({ kind: "api-key" });
		assert.equal(auth.headerName, "X-API-Key");
	});

	it("basic 认证", () => {
		const auth = normalizeAuth({ kind: "basic", username: "user" });
		assert.equal(auth.kind, "basic");
		assert.equal(auth.username, "user");
	});

	it("basic 缺少用户名抛错", () => {
		assert.throws(() => normalizeAuth({ kind: "basic" }), ApiSourceError);
	});

	it("不支持的认证方式抛错", () => {
		assert.throws(() => normalizeAuth({ kind: "oauth" }), ApiSourceError);
	});
});

describe("api-source · normalizeApiSource", () => {
	it("归一化最小配置", () => {
		const config = normalizeApiSource({
			name: "test-api",
			url: "https://api.example.com/data",
		});
		assert.equal(config.name, "test-api");
		assert.equal(config.url, "https://api.example.com/data");
		assert.equal(config.method, "GET");
		assert.equal(config.auth.kind, "none");
	});

	it("缺少名称抛错", () => {
		assert.throws(() => normalizeApiSource({ url: "https://x.com" }), ApiSourceError);
	});

	it("缺少 URL 抛错", () => {
		assert.throws(() => normalizeApiSource({ name: "test" }), ApiSourceError);
	});

	it("非 http(s) 协议抛错", () => {
		assert.throws(() => normalizeApiSource({ name: "test", url: "ftp://x.com" }), ApiSourceError);
	});

	it("只支持 GET", () => {
		assert.throws(() => normalizeApiSource({ name: "test", url: "https://x.com", method: "POST" }), ApiSourceError);
	});

	it("行数上限校验", () => {
		assert.throws(() => normalizeApiSource({ name: "test", url: "https://x.com", rowLimit: 0 }), ApiSourceError);
		assert.throws(() => normalizeApiSource({ name: "test", url: "https://x.com", rowLimit: 10000 }), ApiSourceError);
	});
});

describe("api-source · buildAuthHeaders", () => {
	it("none 返回空", () => {
		assert.deepEqual(buildAuthHeaders({ kind: "none" }, "secret"), {});
	});

	it("bearer 组装 Authorization", () => {
		const headers = buildAuthHeaders({ kind: "bearer" }, "my-token");
		assert.deepEqual(headers, { Authorization: "Bearer my-token" });
	});

	it("bearer 缺少 token 抛错", () => {
		assert.throws(() => buildAuthHeaders({ kind: "bearer" }, ""), ApiSourceError);
	});

	it("api-key 组装自定义头", () => {
		const headers = buildAuthHeaders({ kind: "api-key", headerName: "X-API-Key" }, "key123");
		assert.deepEqual(headers, { "X-API-Key": "key123" });
	});

	it("api-key 带 prefix", () => {
		const headers = buildAuthHeaders({ kind: "api-key", headerName: "Authorization", prefix: "Token" }, "key123");
		assert.deepEqual(headers, { Authorization: "Token key123" });
	});

	it("basic 组装 Base64", () => {
		const headers = buildAuthHeaders({ kind: "basic", username: "user" }, "pass");
		const expected = Buffer.from("user:pass").toString("base64");
		assert.deepEqual(headers, { Authorization: `Basic ${expected}` });
	});
});

describe("api-source · buildRequestHeaders", () => {
	it("合并自定义头 + 认证头 + Accept", () => {
		const headers = buildRequestHeaders(
			{ headers: { "X-Custom": "val" }, auth: { kind: "bearer" } },
			"token",
		);
		assert.equal(headers.Accept, "application/json");
		assert.equal(headers["X-Custom"], "val");
		assert.equal(headers.Authorization, "Bearer token");
	});
});

describe("api-source · extractRecords", () => {
	it("空路径取根数组", () => {
		const records = extractRecords([1, 2, 3], "");
		assert.deepEqual(records, [1, 2, 3]);
	});

	it("按路径取嵌套数组", () => {
		const records = extractRecords({ data: { list: [{ id: 1 }, { id: 2 }] } }, "data.list");
		assert.deepEqual(records, [{ id: 1 }, { id: 2 }]);
	});

	it("路径不存在抛错", () => {
		assert.throws(() => extractRecords({ data: {} }, "data.list"), ApiSourceError);
	});

	it("路径指向非数组抛错", () => {
		assert.throws(() => extractRecords({ data: "not array" }, "data"), ApiSourceError);
	});

	it("路径中途断掉抛错", () => {
		assert.throws(() => extractRecords({ data: null }, "data.list"), ApiSourceError);
	});

	it("带下标的路径", () => {
		const records = extractRecords({ data: [{ items: [1, 2] }] }, "data[0].items");
		assert.deepEqual(records, [1, 2]);
	});
});

describe("api-source · tableFromRecords", () => {
	it("空数组返回空表", () => {
		const result = tableFromRecords([]);
		assert.deepEqual(result.columns, []);
		assert.deepEqual(result.rows, []);
		assert.equal(result.truncated, false);
	});

	it("提取列名并集", () => {
		const records = [{ a: 1, b: 2 }, { b: 3, c: 4 }];
		const result = tableFromRecords(records);
		assert.deepEqual(result.columns, ["a", "b", "c"]);
		assert.equal(result.rows.length, 2);
	});

	it("行截断标记", () => {
		const records = Array.from({ length: 100 }, (_, i) => ({ id: i }));
		const result = tableFromRecords(records, { rowLimit: 10 });
		assert.equal(result.truncated, true);
		assert.equal(result.rows.length, 10);
		assert.equal(result.totalRecords, 100);
	});

	it("嵌套对象序列化为 JSON", () => {
		const records = [{ meta: { key: "value" } }];
		const result = tableFromRecords(records);
		assert.equal(result.rows[0].meta, '{"key":"value"}');
	});

	it("undefined 转为 null", () => {
		const records = [{ a: 1 }, { a: undefined }];
		const result = tableFromRecords(records);
		assert.equal(result.rows[1].a, null);
	});

	it("标量数组退化为单列", () => {
		const records = [1, 2, 3];
		const result = tableFromRecords(records);
		assert.deepEqual(result.columns, ["value"]);
		assert.equal(result.rows.length, 3);
	});
});

describe("api-source · toNdjson", () => {
	it("空数组返回空串", () => {
		assert.equal(toNdjson([]), "");
	});

	it("每行一个 JSON", () => {
		const ndjson = toNdjson([{ id: 1 }, { id: 2 }]);
		assert.equal(ndjson, '{"id":1}\n{"id":2}\n');
	});
});

describe("api-source · snapshotFileName", () => {
	it("英文名直接转 slug", () => {
		assert.equal(snapshotFileName("my-api"), "my-api.ndjson");
	});

	it("中文名用哈希", () => {
		const name = snapshotFileName("我的接口");
		assert.match(name, /^src-[a-f0-9]{12}\.ndjson$/);
	});

	it("空名抛错", () => {
		assert.throws(() => snapshotFileName(""), ApiSourceError);
	});
});

describe("api-source · topLevelKeys", () => {
	it("数组返回长度", () => {
		assert.match(topLevelKeys([1, 2, 3]), /长度 3/);
	});

	it("对象返回键名", () => {
		assert.match(topLevelKeys({ data: {}, code: 0 }), /data, code|code, data/);
	});

	it("空对象", () => {
		assert.match(topLevelKeys({}), /空对象/);
	});

	it("null", () => {
		assert.match(topLevelKeys(null), /null/);
	});
});

describe("api-source · inferColumnTypes", () => {
	it("整数列标为 bigint", () => {
		const types = inferColumnTypes([{ id: 1 }, { id: 2 }], ["id"]);
		assert.equal(types.id, "bigint");
	});

	it("小数列标为 double", () => {
		const types = inferColumnTypes([{ price: 1.5 }], ["price"]);
		assert.equal(types.price, "double");
	});

	it("混合数字标为 double", () => {
		const types = inferColumnTypes([{ val: 1 }, { val: 1.5 }], ["val"]);
		assert.equal(types.val, "double");
	});

	it("布尔列标为 boolean", () => {
		const types = inferColumnTypes([{ active: true }], ["active"]);
		assert.equal(types.active, "boolean");
	});

	it("对象列标为 json", () => {
		const types = inferColumnTypes([{ meta: { key: "val" } }], ["meta"]);
		assert.equal(types.meta, "json");
	});

	it("混合类型标为 varchar", () => {
		const types = inferColumnTypes([{ val: 1 }, { val: "text" }], ["val"]);
		assert.equal(types.val, "varchar");
	});

	it("全 null 标为 varchar", () => {
		const types = inferColumnTypes([{ val: null }, { val: null }], ["val"]);
		assert.equal(types.val, "varchar");
	});
});
