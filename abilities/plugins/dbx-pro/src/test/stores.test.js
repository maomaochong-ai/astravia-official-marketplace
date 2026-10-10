/**
 * 持久化 store 集成测试 — 用内存假 storage 通过 setRuntime 注入，
 * 覆盖 workbench-settings-store 与 query-history-store 的读写 / 裁剪 / 重置。
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { setRuntime } from "../runtime-contract.ts";
import RTL from "@testing-library/react";
import { useVisualizationStore } from "../features/visualization/visualization-store.ts";
import {
	DEFAULT_SETTINGS,
	isDefaultSettings,
} from "../domain/workbench-settings.ts";
import {
	readSettings,
	resetSettings,
	writeSettings,
} from "../domain/workbench-settings-store.ts";
import {
	appendHistoryEntry,
	clearHistory,
	dropHistoryEntry,
	readHistory,
	writeHistory,
} from "../domain/query-history-store.ts";
import { newHistoryId } from "../domain/query-history.ts";

const { act, cleanup, renderHook, waitFor } = RTL;

/** 内存 storage：只实现 store 模块实际使用的 readFile/writeFile。 */
function createMemoryStorage() {
	const files = new Map();
	return {
		files,
		readFile(path) {
			return Promise.resolve(files.has(path) ? files.get(path) : null);
		},
		writeFile(path, data) {
			files.set(path, data);
			return Promise.resolve({ revision: "rev" });
		},
	};
}

function setupRuntime() {
	const storage = createMemoryStorage();
	setRuntime({ storage });
	return storage;
}

after(() => {
	setRuntime(null);
});

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

describe("workbench-settings-store", () => {
	it("无文件时 readSettings 返回默认设置", async () => {
		setupRuntime();
		const settings = await readSettings();
		assert.equal(isDefaultSettings(settings), true);
	});

	it("writeSettings 落盘后 readSettings 读回（坏值被归一）", async () => {
		const storage = setupRuntime();
		await writeSettings({ ...DEFAULT_SETTINGS, queryTimeoutSecs: 45 });
		assert.ok(storage.files.get("workbench-settings.json").includes("45"));
		const readBack = await readSettings();
		assert.equal(readBack.queryTimeoutSecs, 45);
	});

	it("非对象坏文件被宽容归一为默认", async () => {
		const storage = setupRuntime();
		storage.files.set("workbench-settings.json", "{ bad json");
		// JSON 真正解析失败会抛错 —— 这是坏文件的诚实行为（调用方应处理）。
		await assert.rejects(() => readSettings());
	});

	it("resetSettings 恢复出厂并落盘", async () => {
		setupRuntime();
		await writeSettings({ ...DEFAULT_SETTINGS, rowLimit: 10 });
		const reset = await resetSettings();
		assert.equal(isDefaultSettings(reset), true);
		assert.equal((await readSettings()).rowLimit, DEFAULT_SETTINGS.rowLimit);
	});
});

describe("query-history-store", () => {
	it("无文件时 readHistory 返回空数组", async () => {
		setupRuntime();
		assert.deepEqual(await readHistory(), []);
	});

	it("writeHistory / readHistory 往返", async () => {
		setupRuntime();
		const entries = [makeEntry({ sql: "SELECT 1" }), makeEntry({ sql: "SELECT 2" })];
		await writeHistory(entries);
		const readBack = await readHistory();
		assert.equal(readBack.length, 2);
	});

	it("appendHistoryEntry 追加并去重", async () => {
		setupRuntime();
		await appendHistoryEntry(makeEntry({ sql: "SELECT 1" }));
		await appendHistoryEntry(makeEntry({ sql: "SELECT   1" })); // 指纹相同
		const entries = await readHistory();
		assert.equal(entries.length, 1);
	});

	it("dropHistoryEntry 按 id 删除", async () => {
		setupRuntime();
		const keep = makeEntry({ sql: "SELECT 1" });
		const drop = makeEntry({ sql: "SELECT 2" });
		await writeHistory([keep, drop]);
		await dropHistoryEntry(drop.id);
		const entries = await readHistory();
		assert.equal(entries.length, 1);
		assert.equal(entries[0].id, keep.id);
	});

	it("clearHistory 清空", async () => {
		setupRuntime();
		await writeHistory([makeEntry()]);
		await clearHistory();
		assert.deepEqual(await readHistory(), []);
	});

	it("readHistory 按传入 limit 裁剪", async () => {
		setupRuntime();
		await writeHistory(
			Array.from({ length: 30 }, (_, i) => makeEntry({ sql: `SELECT ${i}` })),
		);
		assert.equal((await readHistory(20)).length, 20);
	});
});

/**
 * BI 数据资产产物存储 —— 它比工作台设置 / 查询历史多两条自己的规则（ADR-0009 §5.1）：
 *   1. v1 裸数组文档在**读取**时按 v2 语义升级，条目打 readonlySnapshot，且不写回文件；
 *   2. 单文件 100 条上限，超出时丢弃最旧的条目，并明确告知用户。
 * 模块级单例在一个进程里只 hydrate 一次，所以 v1 用例必须排在任何写入之前。
 */
describe("visualization-store", () => {
	after(() => {
		cleanup();
	});

	it("v1 裸数组文档读成只读快照，只读不删", async () => {
		const storage = setupRuntime();
		const legacy = [
			{
				id: "viz-legacy-1",
				title: "旧看板",
				type: "dashboard",
				connection: "pg",
				table: "orders",
				html: "<html><body>旧产物</body></html>",
				createdAt: 1_700_000_000_000,
			},
		];
		storage.files.set("visualizations.json", JSON.stringify(legacy));

		let hook;
		await act(async () => {
			hook = renderHook(() => useVisualizationStore());
		});
		await waitFor(() => {
			assert.equal(hook.result.current.visualizations.length, 1, "v1 文档没有被读出来");
		});

		const restored = hook.result.current.visualizations[0];
		assert.equal(restored.id, "viz-legacy-1");
		assert.equal(restored.readonlySnapshot, true, "v1 条目必须标成只读快照");
		assert.equal(restored.html, legacy[0].html, "只读快照要原样保留 html");
		assert.deepEqual(restored.chartItems, [], "缺 chartItems 的旧条目要补空数组");
		assert.equal(
			storage.files.get("visualizations.json"),
			JSON.stringify(legacy),
			"读取路径不得写回文件",
		);
	});

	it("到达 100 条上限时丢掉最旧条目并提示用户", async () => {
		const notifyCalls = [];
		const storage = createMemoryStorage();
		setRuntime({
			storage,
			ui: { notify: (payload) => notifyCalls.push(payload) },
		});

		let hook;
		await act(async () => {
			hook = renderHook(() => useVisualizationStore());
		});
		const store = hook.result.current;
		await act(async () => {
			store.clearAll();
		});
		assert.equal(hook.result.current.visualizations.length, 0);

		await act(async () => {
			for (let index = 1; index <= 101; index += 1) {
				store.addVisualization({
					title: `产物 ${index}`,
					type: "dashboard",
					connection: "pg",
					table: "orders",
					chartItems: [],
				});
			}
		});

		const list = hook.result.current.visualizations;
		assert.equal(list.length, 100, "列表必须停在 100 条");
		assert.equal(list[0].title, "产物 101", "新产物排在最前");
		assert.equal(list[99].title, "产物 2", "被丢弃的是最旧的那条");
		assert.deepEqual(notifyCalls, [
			{ message: "BI 数据资产已达上限 100 条，最早的 1 条未能保存", variant: "warning" },
		]);
	});
});
