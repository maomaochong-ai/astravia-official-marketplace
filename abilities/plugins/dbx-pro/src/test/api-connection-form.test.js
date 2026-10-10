/**
 * 「API 接入」表单纯逻辑测试 — 默认值补齐、认证合并、请求头文本互转。
 *
 * 运行: node --experimental-strip-types --test src/test/*.test.js
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AUTH_KIND_OPTIONS,
	apiSpecOf,
	defaultApiSpec,
	headersToText,
	textToHeaders,
	withApiPatch,
	withAuthPatch,
} from "../features/database-workspace/services/api-connection-form.ts";
import { emptyApiConnection } from "../features/database-workspace/services/connection-type-catalog.ts";

function bareConn(overrides = {}) {
	return { id: "c1", name: "订单接口", db_type: "api", host: "", port: 0, ...overrides };
}

describe("apiSpecOf", () => {
	it("没有 api 字段时返回完整默认值", () => {
		assert.deepEqual(apiSpecOf(bareConn()), defaultApiSpec());
	});

	it("补齐缺失的 auth，保留已有字段", () => {
		const spec = apiSpecOf(bareConn({ api: { url: "https://a.example/x", method: "GET", rowLimit: 50 } }));
		assert.equal(spec.url, "https://a.example/x");
		assert.equal(spec.rowLimit, 50);
		assert.equal(spec.method, "GET");
		assert.equal(spec.auth?.kind, "none");
	});

	it("只给了 auth 的一部分时不丢其余默认值", () => {
		const spec = apiSpecOf(
			bareConn({ api: { url: "https://a.example/x", method: "GET", auth: { kind: "api-key" } } }),
		);
		assert.equal(spec.auth?.kind, "api-key");
		assert.equal(spec.dataPath, "");
	});
});

describe("withApiPatch / withAuthPatch", () => {
	it("合并 api 字段且不改写入参", () => {
		const before = emptyApiConnection();
		const after = withApiPatch(before, { url: "https://a.example/orders" });
		assert.equal(after.api?.url, "https://a.example/orders");
		assert.equal(before.api?.url, "");
	});

	it("合并认证字段时保留其它认证配置", () => {
		const conn = withAuthPatch(emptyApiConnection(), { kind: "basic", username: "u" });
		const next = withAuthPatch(conn, { prefix: "Basic" });
		assert.equal(next.api?.auth?.kind, "basic");
		assert.equal(next.api?.auth?.username, "u");
		assert.equal(next.api?.auth?.prefix, "Basic");
	});

	it("认证方式切换不回写 host / port 等引擎字段", () => {
		const conn = emptyApiConnection();
		const next = withAuthPatch(conn, { kind: "bearer" });
		assert.equal(next.host, conn.host);
		assert.equal(next.port, conn.port);
	});
});

describe("headersToText / textToHeaders", () => {
	it("空值 → 空文本", () => {
		assert.equal(headersToText(undefined), "");
		assert.equal(headersToText({}), "");
	});

	it("回环：文本 → 对象 → 文本", () => {
		const headers = { "X-Env": "prod", Accept: "application/json" };
		assert.deepEqual(textToHeaders(headersToText(headers)), headers);
	});

	it("忽略空行、# 注释与缺冒号的行", () => {
		const text = ["X-Env: prod", "", "  # 注释", "没有冒号", ": 空名", "Y:1"].join("\n");
		assert.deepEqual(textToHeaders(text), { "X-Env": "prod", Y: "1" });
	});

	it("值里带冒号时只按第一个冒号切分", () => {
		assert.deepEqual(textToHeaders("X-Url: https://a.example/x"), { "X-Url": "https://a.example/x" });
	});

	it("名称与值两侧空白被裁掉", () => {
		assert.deepEqual(textToHeaders("  X-Env  :  prod  "), { "X-Env": "prod" });
	});
});

describe("AUTH_KIND_OPTIONS", () => {
	it("覆盖四种认证方式且标签非空", () => {
		assert.deepEqual(
			AUTH_KIND_OPTIONS.map((o) => o.kind),
			["none", "bearer", "api-key", "basic"],
		);
		for (const option of AUTH_KIND_OPTIONS) assert.ok(option.label.length > 0);
	});
});
