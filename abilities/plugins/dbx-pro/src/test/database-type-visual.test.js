/**
 * database-type-visual 测试 — 已知类型视觉标识 + 未知类型回退。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DATABASE_TYPE_GROUP_ORDER,
	DATABASE_TYPE_VISUALS,
	getDatabaseTypeVisual,
} from "../domain/database-type-visual.ts";

describe("视觉表完整性", () => {
	it("每个条目的 badge 为 2+ 字符、color 为合法 hex、group 已登记", () => {
		for (const [key, visual] of Object.entries(DATABASE_TYPE_VISUALS)) {
			assert.ok(visual.badge.length >= 2, `${key}: badge 太短`);
			assert.match(visual.color, /^#[0-9a-f]{6}$/, `${key}: 非法颜色`);
			assert.ok(
				DATABASE_TYPE_GROUP_ORDER.includes(visual.group),
				`${key}: group ${visual.group} 未登记`,
			);
		}
	});

	it("分组顺序包含全部 7 组且无重复", () => {
		assert.equal(new Set(DATABASE_TYPE_GROUP_ORDER).size, DATABASE_TYPE_GROUP_ORDER.length);
		assert.equal(DATABASE_TYPE_GROUP_ORDER.length, 7);
	});
});

describe("getDatabaseTypeVisual", () => {
	it("已知类型返回表内标识", () => {
		const visual = getDatabaseTypeVisual("postgres");
		assert.equal(visual, DATABASE_TYPE_VISUALS.postgres);
		assert.equal(visual.badge, "PG");
		assert.equal(visual.group, "relational");
	});

	it("未知类型按名称缩写 + 中性灰回退", () => {
		const visual = getDatabaseTypeVisual("newdb");
		assert.equal(visual.badge, "NE");
		assert.equal(visual.group, "other");
		assert.match(visual.color, /^#/);
	});

	it("多段名称的缩写取前两段首字母", () => {
		const visual = getDatabaseTypeVisual("super-sql-db");
		assert.equal(visual.badge, "SS");
	});
});
