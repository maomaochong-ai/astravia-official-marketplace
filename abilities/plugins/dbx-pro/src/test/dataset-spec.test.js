/**
 * dataset-spec — 数据集规范化、体积估算与三级降级。
 *
 * 这里保护的是「用户的产物不会被悄悄改坏」：裁剪之后 rowCount 必须仍是 SQL 的
 * 完整行数，降级到只留 sql 时必须如实标记，而不是编一份看起来正常的空数据。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DATASET_ROW_LIMIT,
	collectReferencedColumns,
	estimateDatasetBytes,
	fitDatasetSpec,
	normalizeDatasetSpec,
} from "../domain/dataset-spec.ts";

function row(index) {
	return { month: `2026-${String((index % 12) + 1).padStart(2, "0")}`, gmv: index * 1.5, region: "华东" };
}

function bigRows(count) {
	return Array.from({ length: count }, (_, index) => row(index));
}

/** 带一个很宽的、图表并不引用的列：用来验证列裁剪确实省下了空间。 */
function fatRows(count) {
	return Array.from({ length: count }, (_, index) => ({
		month: `2026-${String((index % 12) + 1).padStart(2, "0")}`,
		gmv: index * 1.5,
		unused: "x".repeat(500),
	}));
}

describe("normalizeDatasetSpec — 身份补齐", () => {
	it("缺 id 时按 connection/table/sql 派生稳定 id（同输入同 id）", () => {
		const input = { connection: "pg", table: "orders", sql: "SELECT 1" };
		const first = normalizeDatasetSpec(input);
		const second = normalizeDatasetSpec(input);
		assert.match(first.id, /^ds-[0-9a-f]{8}$/);
		assert.equal(first.id, second.id);
	});

	it("不同 SQL 派生出不同 id", () => {
		const a = normalizeDatasetSpec({ connection: "pg", table: "orders", sql: "SELECT 1" });
		const b = normalizeDatasetSpec({ connection: "pg", table: "orders", sql: "SELECT 2" });
		assert.notEqual(a.id, b.id);
	});

	it("显式 id 优先于派生值", () => {
		const spec = normalizeDatasetSpec({ id: "lce", connection: "pg", table: "orders" });
		assert.equal(spec.id, "lce");
	});

	it("title 缺省回落到 table，再回落到 connection", () => {
		assert.equal(normalizeDatasetSpec({ table: "orders" }).title, "orders");
		assert.equal(normalizeDatasetSpec({ connection: "pg" }).title, "pg");
	});

	it("fetchedAt 缺省用调用方给的时间（便于测试与批量写入对齐）", () => {
		const spec = normalizeDatasetSpec({ table: "t" }, { fetchedAt: 1_700_000_000_000 });
		assert.equal(spec.fetchedAt, 1_700_000_000_000);
	});

	it("显式 fetchedAt 优先于 options", () => {
		const spec = normalizeDatasetSpec({ table: "t", fetchedAt: 5 }, { fetchedAt: 9 });
		assert.equal(spec.fetchedAt, 5);
	});
});

describe("normalizeDatasetSpec — 列与行", () => {
	it("columns 缺失时从行键推断", () => {
		const spec = normalizeDatasetSpec({ rows: [{ a: 1, b: 2 }, { a: 3 }] });
		assert.deepEqual(spec.columns, ["a", "b"]);
	});

	it("显式 columns 优先于推断，且过滤空值", () => {
		const spec = normalizeDatasetSpec({ rows: [{ a: 1 }], columns: ["a", "", 42, "b"] });
		assert.deepEqual(spec.columns, ["a", "b"]);
	});

	it("rows 里的非对象条目被丢弃（半截数据不进图表）", () => {
		const spec = normalizeDatasetSpec({ rows: [{ a: 1 }, null, "nope", [1], 7, { a: 2 }] });
		assert.equal(spec.rows.length, 2);
	});

	it("rows 为空时 columns 退化为空数组而不是报错", () => {
		const spec = normalizeDatasetSpec({ connection: "pg", table: "t" });
		assert.deepEqual(spec.rows, []);
		assert.deepEqual(spec.columns, []);
	});

	it(`rows 超 ${DATASET_ROW_LIMIT} 行时裁剪，但 rowCount 保留 SQL 的完整行数`, () => {
		const spec = normalizeDatasetSpec({
			connection: "pg",
			sql: "SELECT * FROM big",
			rows: bigRows(DATASET_ROW_LIMIT + 500),
			rowCount: DATASET_ROW_LIMIT + 500,
		});
		assert.equal(spec.rows.length, DATASET_ROW_LIMIT);
		assert.equal(spec.rowCount, DATASET_ROW_LIMIT + 500);
	});

	it("rowCount 低于实际行数时取实际行数（不能低报已有数据）", () => {
		const spec = normalizeDatasetSpec({ rows: bigRows(3), rowCount: 1 });
		assert.equal(spec.rowCount, 3);
	});

	it("无 rowCount 时按实际行数填", () => {
		const spec = normalizeDatasetSpec({ rows: bigRows(4) });
		assert.equal(spec.rowCount, 4);
	});

	it("rowLimit 可注入（体积降级需要更激进的上限）", () => {
		const spec = normalizeDatasetSpec({ rows: bigRows(10), rowCount: 10 }, { rowLimit: 3 });
		assert.equal(spec.rows.length, 3);
		assert.equal(spec.rowCount, 10);
	});
});

describe("estimateDatasetBytes", () => {
	it("与 JSON 实际字节数误差小于 10%（含中文与代理对）", () => {
		const spec = normalizeDatasetSpec({
			connection: "pg",
			table: "订单",
			sql: "SELECT 地区, SUM(gmv) FROM 订单 GROUP BY 地区",
			rows: Array.from({ length: 50 }, (_, index) => ({
				region: `华东-${index} 🚀`,
				gmv: 12345.678 + index,
			})),
		});
		const estimated = estimateDatasetBytes(spec);
		const actual = Buffer.byteLength(JSON.stringify(spec), "utf8");
		assert.equal(estimated, actual);
	});

	it("行数翻倍时体积单调增长（可用来定位体积瓶颈）", () => {
		const small = normalizeDatasetSpec({ table: "t", rows: bigRows(10) });
		const large = normalizeDatasetSpec({ table: "t", rows: bigRows(200) });
		assert.equal(estimateDatasetBytes(large) > estimateDatasetBytes(small), true);
	});
});

describe("collectReferencedColumns", () => {
	it("只统计指向该数据集的 source，并去重", () => {
		const items = [
			{ type: "bar", data: {}, source: { datasetId: "a", labelColumn: "month", valueColumns: ["gmv", "gmv"] } },
			{ type: "line", data: {}, source: { datasetId: "b", labelColumn: "day", valueColumns: ["cnt"] } },
			{ type: "pie", data: {} },
		];
		assert.deepEqual(collectReferencedColumns(items, "a").sort(), ["gmv", "month"]);
		assert.deepEqual(collectReferencedColumns(items, "missing"), []);
	});
});

describe("fitDatasetSpec — 体积三级降级", () => {
	it("未超限时原样保留", () => {
		const spec = normalizeDatasetSpec({ connection: "pg", table: "t", rows: bigRows(5) });
		const result = fitDatasetSpec(spec, ["month", "gmv"], 10 * 1024 * 1024);
		assert.equal(result.degraded, "none");
		assert.equal(result.spec, spec);
	});

	it("超限时按引用列裁剪，行数与 rowCount 不变", () => {
		const spec = normalizeDatasetSpec({
			connection: "pg",
			table: "t",
			sql: "SELECT * FROM t",
			rows: fatRows(200),
			rowCount: 200,
		});
		const unpinned = estimateDatasetBytes(spec);
		const result = fitDatasetSpec(spec, ["month", "gmv"], Math.floor(unpinned / 2));
		assert.equal(result.degraded, "columns-pruned");
		assert.deepEqual(result.spec.columns, ["month", "gmv"]);
		assert.equal(result.spec.rows.length, 200);
		assert.equal(result.spec.rowCount, 200);
		assert.equal(result.spec.rows[0].unused, undefined);
		assert.equal(result.spec.rows[0].gmv, 0);
		assert.equal(result.bytes <= Math.floor(unpinned / 2), true);
	});

	it("没有任何图引用该数据集时不做列裁剪（无从判断，不能猜着删）", () => {
		const spec = normalizeDatasetSpec({ connection: "pg", table: "t", rows: bigRows(200) });
		const result = fitDatasetSpec(spec, [], 16);
		assert.equal(result.degraded, "sql-only");
		assert.deepEqual(result.spec.rows, []);
	});

	it("列裁剪仍超限时退到只留 sql，且身份字段与行数如实保留", () => {
		const spec = normalizeDatasetSpec({
			id: "lce",
			connection: "pg",
			table: "t",
			sql: "SELECT * FROM t",
			rows: bigRows(200),
			rowCount: 5000,
			fetchedAt: 1_700_000_000_000,
		});
		const result = fitDatasetSpec(spec, ["month", "gmv"], 200);
		assert.equal(result.degraded, "sql-only");
		assert.equal(result.spec.id, "lce");
		assert.equal(result.spec.sql, "SELECT * FROM t");
		assert.deepEqual(result.spec.rows, []);
		assert.equal(result.spec.rowCount, 5000);
		assert.equal(result.spec.fetchedAt, 1_700_000_000_000);
	});
});
