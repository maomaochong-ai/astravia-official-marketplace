/**
 * FilterBar 逻辑单元测试 —— 过滤逻辑全在 Canvas.tsx + FilterBar.tsx 里，
 * 但核心可独立验证：Set toggle、跨 source 列跳过、空 Set 等价不过滤
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** 模拟 Canvas.tsx 里的 filteredDataSources useMemo 逻辑 */
function applyFilters(dataSources, filters) {
	if (Object.keys(filters).length === 0) return dataSources;
	return dataSources.map((src) => ({
		...src,
		rows: src.rows.filter((row) =>
			Object.entries(filters).every(([col, selected]) => {
				if (!src.columns.includes(col)) return true; // source 没这列 → 跳过 filter
				const v = row[col];
				return selected.size === 0 || selected.has(v);
			}),
		),
	}));
}

describe("FilterBar — 跨数据源过滤逻辑", () => {
	const dsUsers = {
		id: "users",
		columns: ["id", "country", "status"],
		rows: [
			{ id: 1, country: "US", status: "active" },
			{ id: 2, country: "CN", status: "active" },
			{ id: 3, country: "US", status: "inactive" },
			{ id: 4, country: "JP", status: "active" },
		],
	};
	const dsOrders = {
		id: "orders",
		columns: ["order_id", "country", "amount"],
		rows: [
			{ order_id: "A", country: "US", amount: 100 },
			{ order_id: "B", country: "CN", amount: 200 },
			{ order_id: "C", country: "US", amount: 150 },
		],
	};
	const dsLog = {
		id: "log",
		columns: ["event", "timestamp"], // 没有 country 列
		rows: [
			{ event: "login", timestamp: "2025-01-01" },
			{ event: "logout", timestamp: "2025-01-02" },
		],
	};

	it("空 filters → 不过滤任何行", () => {
		const result = applyFilters([dsUsers, dsOrders], {});
		assert.equal(result[0].rows.length, dsUsers.rows.length);
		assert.equal(result[1].rows.length, dsOrders.rows.length);
	});

	it("country=US → 两个有 country 列的 source 都被过滤", () => {
		const f = { country: new Set(["US"]) };
		const result = applyFilters([dsUsers, dsOrders, dsLog], f);

		// users: 只剩 US (id:1, id:3)
		assert.equal(result[0].rows.length, 2);
		assert.ok(result[0].rows.every((r) => r.country === "US"));

		// orders: 只剩 US (A, C)
		assert.equal(result[1].rows.length, 2);
		assert.ok(result[1].rows.every((r) => r.country === "US"));

		// log: 没有 country 列 → 保持全量
		assert.equal(result[2].rows.length, dsLog.rows.length);
	});

	it("跨列 AND: country=US + status=active", () => {
		const f = { country: new Set(["US"]), status: new Set(["active"]) };
		const result = applyFilters([dsUsers, dsOrders], f);

		// users: country=US AND status=active → id:1 only (id:3 是 inactive)
		assert.equal(result[0].rows.length, 1);
		assert.equal(result[0].rows[0].id, 1);

		// orders: 没有 status 列 → 只按 country 过滤
		assert.equal(result[1].rows.length, 2);
	});

	it("所有行被筛光 → rows 变空数组（FrameWidget 应该显示空占位符）", () => {
		const f = { country: new Set(["XX"]) }; // 不存在的国家
		const result = applyFilters([dsUsers], f);
		assert.equal(result[0].rows.length, 0);
		assert.ok(Array.isArray(result[0].rows));
	});

	it("多值 Set: country in {US, JP}", () => {
		const f = { country: new Set(["US", "JP"]) };
		const result = applyFilters([dsUsers], f);
		assert.equal(result[0].rows.length, 3); // id:1 US, id:3 US, id:4 JP
	});

	it("Set toggle 语义：第一次加，第二次移", () => {
		let sel = new Set();
		// toggle "US" (不在 → 加)
		if (!sel.has("US")) sel.add("US");
		assert.ok(sel.has("US"));
		assert.equal(sel.size, 1);

		// toggle "US" (在 → 移)
		if (sel.has("US")) sel.delete("US");
		assert.equal(sel.size, 0);

		// toggle "CN" (加) + toggle "JP" (加)
		sel.add("CN"); sel.add("JP");
		assert.equal(sel.size, 2);
		assert.ok(sel.has("CN") && sel.has("JP"));
	});

	it("空 Set 作为 selected → 等价不过滤（Set.empty() 语义）", () => {
		// FilterBar 清空按钮会传 new Set() — 应该不过滤
		const f = { country: new Set() }; // 空 Set ≠ 无 filter key
		const result = applyFilters([dsUsers], f);
		assert.equal(result[0].rows.length, dsUsers.rows.length);
	});

	it("filter key 在 columns 里但 Set 里有值时，精确匹配值", () => {
		const f = { status: new Set(["inactive"]) };
		const result = applyFilters([dsUsers], f);
		assert.equal(result[0].rows.length, 1);
		assert.equal(result[0].rows[0].status, "inactive");
	});
});
