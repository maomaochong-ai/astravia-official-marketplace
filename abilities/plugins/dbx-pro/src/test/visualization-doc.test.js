/**
 * visualization-doc — 「BI 数据资产」存储文档的读写与 v1 → v2 迁移。
 *
 * 覆盖四类输入：v1 裸数组、v2 文档、无法识别的输入、混合可信度条目。
 * 迁移的硬约束是**只读不删**：v1 条目必须原样保留 html + chartItems，
 * 只额外打上 readonlySnapshot —— 丢失用户产物比迁移失败严重得多。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CURRENT_DOC_VERSION,
	readVisualizationDoc,
	toVisualizationDoc,
} from "../domain/visualization-doc.ts";

/** v1 形态的条目：只有 html，没有 chartItems（迁移前的真实历史数据）。 */
function legacyEntry(id, extra = {}) {
	return {
		id,
		title: `看板 ${id}`,
		type: "dashboard",
		connection: "pg",
		table: "orders",
		html: "<html><body>chart</body></html>",
		sql: "SELECT 1",
		createdAt: 1_700_000_000_000,
		...extra,
	};
}

describe("readVisualizationDoc — v1 裸数组", () => {
	it("读取条目并补上缺失的 chartItems", () => {
		const items = readVisualizationDoc([legacyEntry("a")]);
		assert.equal(items.length, 1);
		assert.deepEqual(items[0].chartItems, []);
		assert.equal(items[0].html, "<html><body>chart</body></html>");
		assert.equal(items[0].sql, "SELECT 1");
	});

	it("每条都标记为只读快照（没有可编辑的数据来源）", () => {
		const items = readVisualizationDoc([legacyEntry("a"), legacyEntry("b")]);
		assert.equal(items.every((entry) => entry.readonlySnapshot === true), true);
	});

	it("已有 chartItems 的条目保持原值，不被覆盖", () => {
		const chartItems = [{ type: "bar", data: { labels: ["x"], datasets: [] } }];
		const items = readVisualizationDoc([legacyEntry("a", { chartItems })]);
		assert.deepEqual(items[0].chartItems, chartItems);
	});

	it("空数组 → 空数组", () => {
		assert.deepEqual(readVisualizationDoc([]), []);
	});
});

describe("readVisualizationDoc — v2 文档", () => {
	it("读取 { schemaVersion, items } 且不标记只读（条目本身可编辑）", () => {
		const items = readVisualizationDoc({
			schemaVersion: 2,
			items: [legacyEntry("a", { chartItems: [] })],
		});
		assert.equal(items.length, 1);
		assert.equal("readonlySnapshot" in items[0], false);
	});

	it("缺少 schemaVersion 但带 items 的中间态仍可读", () => {
		const items = readVisualizationDoc({ items: [legacyEntry("a")] });
		assert.equal(items.length, 1);
	});

	it("items 不是数组 → 空数组（不抛错）", () => {
		assert.deepEqual(readVisualizationDoc({ schemaVersion: 2, items: "nope" }), []);
		assert.deepEqual(readVisualizationDoc({ schemaVersion: 2 }), []);
	});
});

describe("readVisualizationDoc — 无法识别的输入", () => {
	it("null / undefined / 标量 / 字符串 → 空数组", () => {
		for (const raw of [null, undefined, 42, "junk", true]) {
			assert.deepEqual(readVisualizationDoc(raw), []);
		}
	});

	it("数组里混入的非对象条目被丢弃，可信条目保留", () => {
		const items = readVisualizationDoc([
			legacyEntry("keep"),
			null,
			"nope",
			42,
			["nested"],
			{ title: "没有 id" },
		]);
		assert.equal(items.length, 1);
		assert.equal(items[0].id, "keep");
	});

	it("id 为空字符串的条目被丢弃", () => {
		assert.deepEqual(readVisualizationDoc([legacyEntry("")]), []);
	});
});

describe("toVisualizationDoc", () => {
	it("写出当前版本的文档外壳", () => {
		const doc = toVisualizationDoc(readVisualizationDoc([legacyEntry("a")]));
		assert.equal(doc.schemaVersion, CURRENT_DOC_VERSION);
		assert.equal(Array.isArray(doc.items), true);
		assert.equal(doc.items.length, 1);
	});

	it("往返：v1 → 读 → 写 v2 → 再读，身份与内容不丢", () => {
		const first = readVisualizationDoc([
			legacyEntry("a"),
			legacyEntry("b", { type: "screen", table: "logs" }),
		]);
		const second = readVisualizationDoc(JSON.parse(JSON.stringify(toVisualizationDoc(first))));

		assert.deepEqual(
			second.map((entry) => entry.id),
			["a", "b"],
		);
		assert.equal(second[0].html, first[0].html);
		assert.equal(second[1].type, "screen");
		assert.equal(second[1].table, "logs");
		// 只读快照标记必须在往返后保留，否则 UI 会把不可编辑的产物当成可编辑
		assert.equal(second.every((entry) => entry.readonlySnapshot === true), true);
	});
});
