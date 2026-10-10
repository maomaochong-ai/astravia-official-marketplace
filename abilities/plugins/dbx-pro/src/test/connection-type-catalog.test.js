/**
 * connection-type-catalog 纯逻辑测试 — 分组、文件型判定、默认值与初始草稿。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CATEGORY_DEFS,
	DEFAULT_USERNAME_BY_DB_TYPE,
	FILE_BASED_DB_TYPES,
	defaultHostPlaceholder,
	defaultUsernameFor,
	emptyConnection,
	groupManifestByCategory,
	isFileBasedDbType,
} from "../features/database-workspace/services/connection-type-catalog.ts";
import { DB_TYPE_MANIFEST } from "../domain/connection-config.ts";

describe("CATEGORY_DEFS", () => {
	it("包含 4 个预定义语义分组", () => {
		assert.equal(CATEGORY_DEFS.length, 4);
	});
	it("组内无重复 dbType", () => {
		for (const cat of CATEGORY_DEFS) {
			assert.equal(new Set(cat.dbTypes).size, cat.dbTypes.length, `${cat.label} 有重复`);
		}
	});
});

describe("groupManifestByCategory", () => {
	it("结果 = manifest 全部条目 + 「接口」虚拟类型，每条恰好出现一次", () => {
		const groups = groupManifestByCategory();
		let count = 0;
		for (const group of groups) count += group.entries.length;
		assert.equal(count, DB_TYPE_MANIFEST.length + 1);
	});

	it("每个组带 label 且非空", () => {
		for (const group of groupManifestByCategory()) {
			assert.ok(group.label.length > 0);
			assert.ok(group.entries.length > 0);
		}
	});

	it("「接口」排在第一组，且只放 api 一个虚拟类型", () => {
		const groups = groupManifestByCategory();
		assert.equal(groups[0].label, "接口");
		assert.deepEqual(groups[0].entries.map((e) => e.dbType), ["api"]);
	});

	it("组内按 order 升序", () => {
		for (const group of groupManifestByCategory()) {
			const orders = group.entries.map((e) => e.order);
			const sorted = orders.slice().sort((a, b) => a - b);
			assert.deepEqual(orders, sorted);
		}
	});

	it("重复归属的类型以后遍历到的分组为准（oceanbase-oracle：国产 后于关系型 SQL）", () => {
		const groups = groupManifestByCategory();
		const find = (label) =>
			groups.find((g) => g.label === label)?.entries.some((e) => e.dbType === "oceanbase-oracle") ?? false;
		assert.equal(find("关系型 SQL"), false);
		assert.equal(find("国产"), true);
	});

	it("未命中预定义组的类型统一进入唯一兜底「其他」", () => {
		const groups = groupManifestByCategory();
		const otherGroups = groups.filter((g) => g.label === "其他");
		assert.equal(otherGroups.length, 1);
		const otherTypes = otherGroups[0].entries.map((e) => e.dbType);
		assert.ok(otherTypes.includes("trino"));
		assert.ok(otherTypes.includes("cassandra"));
	});
});

describe("isFileBasedDbType", () => {
	for (const type of ["sqlite", "cloudflare-d1", "turso", "duckdb"]) {
		it(`${type} 是文件型`, () => assert.equal(isFileBasedDbType(type), true));
	}
	it("普通网络数据库不是文件型", () => {
		assert.equal(isFileBasedDbType("postgres"), false);
		assert.equal(isFileBasedDbType("mysql"), false);
	});
	it("FILE_BASED_DB_TYPES 与判定一致", () => {
		for (const type of FILE_BASED_DB_TYPES) {
			assert.equal(isFileBasedDbType(type), true);
		}
	});
});

describe("defaultHostPlaceholder", () => {
	it("文件型给文件路径占位", () => {
		assert.equal(defaultHostPlaceholder("sqlite"), "/path/to/db.sqlite");
	});
	it("网络型给 localhost", () => {
		assert.equal(defaultHostPlaceholder("postgres"), "localhost");
	});
});

describe("defaultUsernameFor", () => {
	it("已登记类型返回映射值", () => {
		assert.equal(defaultUsernameFor("postgres"), "postgres");
		assert.equal(defaultUsernameFor("mysql"), "root");
		assert.equal(defaultUsernameFor("sqlserver"), "sa");
	});
	it("未登记类型返回空串", () => {
		assert.equal(defaultUsernameFor("totally-new"), "");
	});
	it("DEFAULT_USERNAME_BY_DB_TYPE 的值都是字符串", () => {
		for (const value of Object.values(DEFAULT_USERNAME_BY_DB_TYPE)) {
			assert.equal(typeof value, "string");
		}
	});
});

describe("emptyConnection", () => {
	const empty = emptyConnection();

	it("id 为非空字符串", () => {
		assert.equal(typeof empty.id, "string");
		assert.ok(empty.id.length > 0);
	});

	it("默认类型取自 manifest 首项，端口与 host 匹配", () => {
		const first = DB_TYPE_MANIFEST[0];
		assert.equal(empty.db_type, first.dbType);
		assert.equal(empty.port, first.defaultPort);
	});

	it("默认安全标记：非生产、非只读、ssl 关闭", () => {
		assert.equal(empty.is_production, false);
		assert.equal(empty.read_only, false);
		assert.equal(empty.ssl, false);
	});

	it("两次调用 id 不同", () => {
		assert.notEqual(emptyConnection().id, emptyConnection().id);
	});
});
