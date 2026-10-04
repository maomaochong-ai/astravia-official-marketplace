/**
 * driver-tiers 纯逻辑测试 — 一切类型走 dbx-mcp。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isReadyDbType,
	supportsLocalCliFallback,
	tierFor,
	tierLabel,
	tierReasonText,
	tierStats,
} from "../domain/driver-tiers.ts";

describe("tierFor", () => {
	for (const type of [
		"postgres", "postgresql", "mysql", "mariadb", "sqlite", "redis",
		"clickhouse", "bigquery", "snowflake", "mongodb", "unknown-new-db",
	]) {
		it(`${type} → dbx-mcp`, () => assert.equal(tierFor(type), "dbx-mcp"));
	}

	it("大小写 / 空白 / 分隔符归一后仍返回 dbx-mcp", () => {
		assert.equal(tierFor("PostgreSQL"), "dbx-mcp");
		assert.equal(tierFor("  sql_server "), "dbx-mcp");
	});
});

describe("档位展示文案", () => {
	it("tierLabel 恒定 dbx-mcp", () => {
		assert.equal(tierLabel("dbx-mcp"), "dbx-mcp");
	});
	it("tierReasonText 给出可查询说明", () => {
		assert.match(tierReasonText("postgres"), /可直接查询/);
	});
	it("isReadyDbType 恒 true", () => {
		assert.equal(isReadyDbType("anything"), true);
	});
	it("supportsLocalCliFallback 恒 false（CLI fallback 已删除）", () => {
		assert.equal(supportsLocalCliFallback("postgres"), false);
	});
});

describe("tierStats", () => {
	it("统计口径：全部 ready、无 pending", () => {
		assert.deepEqual(tierStats(), { total: 100, ready: 100, pending: 0 });
	});
});
