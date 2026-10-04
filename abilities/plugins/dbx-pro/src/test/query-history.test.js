/**
 * query-history 纯逻辑测试 — 夹逼、指纹去重、历史解析 / 裁剪 / 追加与时间文案。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	HISTORY_LIMIT_DEFAULT,
	HISTORY_LIMIT_MAX,
	HISTORY_LIMIT_MIN,
	HISTORY_SQL_MAX_CHARS,
	appendHistory,
	clampHistoryLimit,
	clampInt,
	formatHistoryTime,
	newHistoryId,
	normalizeHistory,
	normalizeHistoryEntry,
	pruneHistory,
	removeHistoryEntry,
	sqlFingerprint,
	summarizeSql,
} from "../domain/query-history.ts";

function makeEntry(partial = {}) {
	return {
		id: newHistoryId(),
		connName: "db",
		dbType: "postgres",
		sql: "SELECT 1",
		status: "ok",
		path: "engine",
		rowCount: 1,
		durationMs: 5,
		createdAt: new Date().toISOString(),
		...partial,
	};
}

describe("clampInt", () => {
	it("范围内数值原样返回（截断小数）", () => {
		assert.equal(clampInt(15.9, 0, 100, 50), 15);
	});
	it("越界夹到边界", () => {
		assert.equal(clampInt(-10, 0, 100, 50), 0);
		assert.equal(clampInt(200, 0, 100, 50), 100);
	});
	it("不可解析值回落默认", () => {
		assert.equal(clampInt("abc", 0, 100, 50), 50);
		assert.equal(clampInt(undefined, 0, 100, 50), 50);
	});
});

describe("clampHistoryLimit", () => {
	it("合法值保留", () => assert.equal(clampHistoryLimit(100), 100));
	it("越界夹到 MIN/MAX", () => {
		assert.equal(clampHistoryLimit(1), HISTORY_LIMIT_MIN);
		assert.equal(clampHistoryLimit(100_000), HISTORY_LIMIT_MAX);
	});
	it("坏值回落默认", () => assert.equal(clampHistoryLimit("x"), HISTORY_LIMIT_DEFAULT));
});

describe("sqlFingerprint", () => {
	it("空白折叠 + 首尾去空白", () => {
		assert.equal(sqlFingerprint("  SELECT   1\nFROM  t "), "SELECT 1 FROM t");
	});
	it("非字符串输入安全处理", () => {
		assert.equal(sqlFingerprint(undefined), "");
	});
});

describe("summarizeSql", () => {
	it("短 SQL 原样返回", () => assert.equal(summarizeSql("SELECT 1"), "SELECT 1"));
	it("超长 SQL 截断并加省略号", () => {
		const long = "SELECT " + "x".repeat(200);
		const summary = summarizeSql(long, 50);
		assert.equal(summary.length, 50);
		assert.ok(summary.endsWith("…"));
	});
});

describe("normalizeHistoryEntry", () => {
	it("合法条目归一", () => {
		const entry = normalizeHistoryEntry(makeEntry());
		assert.equal(entry.connName, "db");
		assert.equal(entry.status, "ok");
		assert.equal(entry.path, "engine");
	});

	it("非对象 / 空 SQL → null", () => {
		assert.equal(normalizeHistoryEntry(null), null);
		assert.equal(normalizeHistoryEntry({}), null);
		assert.equal(normalizeHistoryEntry({ sql: "   " }), null);
	});

	it("缺失字段用默认值填充", () => {
		const entry = normalizeHistoryEntry({ sql: "SELECT 1" });
		assert.equal(entry.connName, "(未命名连接)");
		assert.equal(entry.status, "ok");
		assert.equal(entry.rowCount, 0);
		assert.equal(entry.durationMs, 0);
		assert.ok(entry.id);
	});

	it("error 状态保留截断后的错误信息", () => {
		const entry = normalizeHistoryEntry({
			sql: "SELECT 1",
			status: "error",
			error: "boom".repeat(1000),
		});
		assert.equal(entry.status, "error");
		assert.equal(entry.error.length, 1000);
	});

	it("超长 SQL 裁剪到防御上限", () => {
		const entry = normalizeHistoryEntry({ sql: "SELECT " + "x".repeat(30_000) });
		assert.equal(entry.sql.length, HISTORY_SQL_MAX_CHARS);
	});

	it("非法时间回落当前时间", () => {
		const now = new Date("2024-01-01T00:00:00Z");
		const entry = normalizeHistoryEntry({ sql: "SELECT 1", createdAt: "not-a-date" }, now);
		assert.equal(entry.createdAt, now.toISOString());
	});
});

describe("normalizeHistory / pruneHistory", () => {
	it("逐条过滤坏条目", () => {
		const result = normalizeHistory([makeEntry(), { sql: "" }, makeEntry()]);
		assert.equal(result.length, 2);
	});
	it("非数组输入 → 空列表", () => assert.deepEqual(normalizeHistory("x"), []));
	it("裁剪到上限（保留最前面）", () => {
		const entries = Array.from({ length: 50 }, (_, i) =>
			makeEntry({ sql: `SELECT ${i}` }));
		const result = pruneHistory(entries, 20);
		assert.equal(result.length, 20);
		assert.equal(result[0].sql, "SELECT 0");
	});
});

describe("appendHistory", () => {
	it("新条目置顶", () => {
		const first = makeEntry({ sql: "SELECT 1" });
		const second = makeEntry({ sql: "SELECT 2" });
		const result = appendHistory([first], second);
		assert.equal(result[0].sql, "SELECT 2");
	});

	it("同连接 + 同 SQL 去重（空白差异也视为同一条）", () => {
		const original = makeEntry({ sql: "SELECT 1" });
		const repeat = makeEntry({ sql: "SELECT   1" });
		const result = appendHistory([original], repeat);
		assert.equal(result.length, 1);
		assert.equal(result[0], repeat);
	});

	it("不同连接的相同 SQL 不算重复", () => {
		const a = makeEntry({ connName: "a", sql: "SELECT 1" });
		const b = makeEntry({ connName: "b", sql: "SELECT 1" });
		assert.equal(appendHistory([a], b).length, 2);
	});

	it("按上限裁剪", () => {
		const entries = Array.from({ length: 20 }, (_, i) =>
			makeEntry({ connName: "db", sql: `SELECT ${i}` }));
		const fresh = makeEntry({ sql: "SELECT new" });
		assert.equal(appendHistory(entries, fresh, 10).length, 10);
	});

	it("不修改入参数组", () => {
		const original = [makeEntry()];
		const snapshot = original.slice();
		appendHistory(original, makeEntry({ sql: "SELECT 2" }));
		assert.equal(original.length, snapshot.length);
	});
});

describe("removeHistoryEntry", () => {
	it("按 id 删除", () => {
		const keep = makeEntry();
		const drop = makeEntry();
		const result = removeHistoryEntry([keep, drop], drop.id);
		assert.equal(result.length, 1);
		assert.equal(result[0], keep);
	});
});

describe("formatHistoryTime", () => {
	const now = Date.parse("2025-06-01T12:00:00Z");
	it("秒级 / 分钟级 → 刚刚 / N 分钟前", () => {
		assert.equal(formatHistoryTime(new Date(now - 5_000).toISOString(), now), "刚刚");
		assert.equal(formatHistoryTime(new Date(now - 5 * 60_000).toISOString(), now), "5 分钟前");
	});
	it("小时 / 天级文案", () => {
		assert.equal(formatHistoryTime(new Date(now - 3 * 3600_000).toISOString(), now), "3 小时前");
		assert.equal(formatHistoryTime(new Date(now - 2 * 86400_000).toISOString(), now), "2 天前");
	});
	it("30 天以上显示日期", () => {
		const result = formatHistoryTime(new Date(now - 100 * 86400_000).toISOString(), now);
		assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
	});
	it("非法时间 → 时间未知", () => {
		assert.equal(formatHistoryTime("bad-date", now), "时间未知");
	});
});
