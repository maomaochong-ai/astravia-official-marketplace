/**
 * inferSchema — 列角色推断测试（v0.0.103 从 infer-layout.test.js 迁移）。
 *
 * inferLayout 规则引擎已删除，只保留 FilterBar 依赖的 inferSchema。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inferSchema } from "../shared/services/infer-schema.ts";

describe("inferSchema — 列角色推断", () => {
	it("time pattern → time", () => {
		const meta = inferSchema(["order_date"], [{ order_date: "2025-01-01" }]);
		assert.equal(meta[0].role, "time");
	});
	it("count pattern → measure", () => {
		const meta = inferSchema(["order_count"], [{ order_count: 42 }]);
		assert.equal(meta[0].role, "measure");
	});
	it("null values 不影响 cardinality", () => {
		const meta = inferSchema(["status"], [{ status: "active" }, { status: null }, { status: "active" }, { status: "inactive" }]);
		assert.equal(meta[0].cardinality, 2); // active + inactive，null 不算
	});
	it("numeric majority → measure", () => {
		const meta = inferSchema(["score"], [{ score: 95 }, { score: 88 }, { score: 76 }]);
		assert.equal(meta[0].role, "measure");
	});
});
