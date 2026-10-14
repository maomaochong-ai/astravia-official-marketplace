/**
 * connection-ref — 「节点里存的连接引用」→「引擎连接名」的解析。
 *
 * 这条解析是数据源节点的支点：属性面板写进 values 的是连接 **id**（`c.id`），
 * 而引擎的执行/列表接口都以连接 **name** 为键，旧页面因此必然执行失败。
 * 这里钉住四点：空值、id 命中、name 命中、都命中不了时原样返回且永不抛异常
 * （它在渲染路径上被调用，抛错会让整个属性面板白屏）。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	connectionDisplayLabel,
	isConnectionResolved,
	resolveConnectionName,
} from "../../features/bi-editor/canvas/lib/connection-ref.ts";
import type { EngineConnectionSummary } from "../../shared/services/engine-client.ts";

/** 造一个连接摘要；只有 id / name / type 参与解析，其余字段补占位值。 */
function conn(id: string, name: string, type = "mysql"): EngineConnectionSummary {
	return { id, name, groupPath: "", type, host: "127.0.0.1", port: 3306, database: "demo" };
}

const CONNECTIONS: EngineConnectionSummary[] = [
	conn("a1b2-uuid", "sales-mysql"),
	conn("c3d4-uuid", "ops-pg", "postgres"),
];

describe("resolveConnectionName — 解析顺序", () => {
	it("空值 / 空白 → 空串（面板未选择数据源）", () => {
		assert.equal(resolveConnectionName(undefined, CONNECTIONS), "");
		assert.equal(resolveConnectionName(null, CONNECTIONS), "");
		assert.equal(resolveConnectionName("", CONNECTIONS), "");
		assert.equal(resolveConnectionName("   ", CONNECTIONS), "");
	});

	it("非字符串 → 空串（拿到脏数据也不抛）", () => {
		assert.equal(resolveConnectionName(42, CONNECTIONS), "");
		assert.equal(resolveConnectionName({ id: "a1b2-uuid" }, CONNECTIONS), "");
		assert.equal(resolveConnectionName([], CONNECTIONS), "");
	});

	it("命中 id → 返回 name（主路径：面板存的是 id）", () => {
		assert.equal(resolveConnectionName("a1b2-uuid", CONNECTIONS), "sales-mysql");
		assert.equal(resolveConnectionName("c3d4-uuid", CONNECTIONS), "ops-pg");
	});

	it("两端空白被裁掉后再匹配", () => {
		assert.equal(resolveConnectionName("  a1b2-uuid  ", CONNECTIONS), "sales-mysql");
	});

	it("命中 name → 原样返回（兼容手填 name 的旧数据）", () => {
		assert.equal(resolveConnectionName("sales-mysql", CONNECTIONS), "sales-mysql");
		assert.equal(resolveConnectionName(" ops-pg ", CONNECTIONS), "ops-pg");
	});

	it("都命中不了 → 原样返回，不静默改写（交给引擎报错）", () => {
		assert.equal(resolveConnectionName("api:legacy", CONNECTIONS), "api:legacy");
		assert.equal(resolveConnectionName("未刷出来的连接", CONNECTIONS), "未刷出来的连接");
	});

	it("连接列表缺失 / 为空时不抛，原样返回", () => {
		assert.equal(resolveConnectionName("a1b2-uuid", undefined), "a1b2-uuid");
		assert.equal(resolveConnectionName("a1b2-uuid", null), "a1b2-uuid");
		assert.equal(resolveConnectionName("a1b2-uuid", []), "a1b2-uuid");
	});

	it("id 与 name 撞值时按 id 优先（顺序固定，结果不抖动）", () => {
		// 值 "x" 既是 conn1 的 id、也是 conn2 的名字：必须稳定解析成 conn1 的 name
		const list = [conn("x", "y"), conn("z", "x")];
		assert.equal(resolveConnectionName("x", list), "y");
	});
});

describe("connectionDisplayLabel — 面板展示", () => {
	it("空值 → 空串", () => {
		assert.equal(connectionDisplayLabel(undefined, CONNECTIONS), "");
		assert.equal(connectionDisplayLabel("   ", CONNECTIONS), "");
	});

	it("解析得到连接 → 「名称 (类型)」", () => {
		assert.equal(connectionDisplayLabel("a1b2-uuid", CONNECTIONS), "sales-mysql (mysql)");
		assert.equal(connectionDisplayLabel("ops-pg", CONNECTIONS), "ops-pg (postgres)");
	});

	it("解析不到 → 原样显示，让用户看到实际存的值", () => {
		assert.equal(connectionDisplayLabel("api:legacy", CONNECTIONS), "api:legacy");
	});
});

describe("isConnectionResolved — 是否已能解析", () => {
	it("空值 / 未知值 → false", () => {
		assert.equal(isConnectionResolved("", CONNECTIONS), false);
		assert.equal(isConnectionResolved(undefined, CONNECTIONS), false);
		assert.equal(isConnectionResolved("api:legacy", CONNECTIONS), false);
		assert.equal(isConnectionResolved("a1b2-uuid", []), false);
	});

	it("命中 id 或 name → true", () => {
		assert.equal(isConnectionResolved("a1b2-uuid", CONNECTIONS), true);
		assert.equal(isConnectionResolved("sales-mysql", CONNECTIONS), true);
	});
});
