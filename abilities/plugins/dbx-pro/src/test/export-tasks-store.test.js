/**
 * export-tasks-store 纯逻辑测试 —— 后台导出任务单例的增删改 / 取消 / 订阅。
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
	addExportTask,
	clearFinishedExportTasks,
	getExportTask,
	getExportTasks,
	registerExportCancelHandler,
	removeExportTask,
	requestCancelExportTask,
	subscribeExportTasks,
	updateExportTask,
} from "../features/database-workspace/state/export-tasks-store.ts";

/** 每个用例前清空模块级 Map（store 没暴露 clearAll，逐个移除即可）。 */
beforeEach(() => {
	for (const task of getExportTasks()) removeExportTask(task.id);
});

describe("addExportTask / 快照", () => {
	it("新任务默认 running、行数 0、totalRows 取传入或 null", () => {
		const task = addExportTask({ fileName: "a.csv", format: "csv", totalRows: 100, database: "db", tableName: "t" });
		assert.equal(task.status, "running");
		assert.equal(task.rowsExported, 0);
		assert.equal(task.totalRows, 100);
		assert.equal(task.database, "db");
		assert.equal(task.tableName, "t");
		assert.equal(task.filePath, null);
		assert.ok(getExportTask(task.id)?.id === task.id);
	});

	it("无变更时 getExportTasks 返回同一引用（useSyncExternalStore 要求）", () => {
		addExportTask({ fileName: "a.csv", format: "csv" });
		const first = getExportTasks();
		const second = getExportTasks();
		assert.equal(first, second);
	});

	it("按插入顺序排列", () => {
		const a = addExportTask({ fileName: "a", format: "csv" });
		const b = addExportTask({ fileName: "b", format: "json" });
		assert.deepEqual(
			getExportTasks().map((t) => t.id),
			[a.id, b.id],
		);
	});
});

describe("订阅通知", () => {
	it("add / update / remove 触发监听", () => {
		let calls = 0;
		const unsubscribe = subscribeExportTasks(() => {
			calls += 1;
		});
		const task = addExportTask({ fileName: "a.csv", format: "csv" });
		updateExportTask(task.id, { rowsExported: 50 });
		removeExportTask(task.id);
		assert.equal(calls, 3);
		unsubscribe();
		const before = calls;
		addExportTask({ fileName: "b.csv", format: "csv" });
		assert.equal(calls, before);
	});

	it("更新不存在的任务不触发通知", () => {
		let called = false;
		const unsubscribe = subscribeExportTasks(() => {
			called = true;
		});
		updateExportTask("missing", { rowsExported: 1 });
		assert.equal(called, false);
		unsubscribe();
	});
});

describe("updateExportTask", () => {
	it("合并补丁且不改 id", () => {
		const task = addExportTask({ fileName: "a.csv", format: "csv" });
		updateExportTask(task.id, {
			status: "done",
			filePath: "/tmp/a.csv",
			finishedAt: 123,
			rowsExported: 10,
		});
		const updated = getExportTask(task.id);
		assert.equal(updated.status, "done");
		assert.equal(updated.filePath, "/tmp/a.csv");
		assert.equal(updated.finishedAt, 123);
		assert.equal(updated.rowsExported, 10);
		assert.equal(updated.id, task.id);
	});
});

describe("requestCancelExportTask", () => {
	it("活动任务转 cancelling 并调用注册的取消处理器", () => {
		const task = addExportTask({ fileName: "a.csv", format: "csv" });
		let cancelled = false;
		registerExportCancelHandler(task.id, () => {
			cancelled = true;
		});
		requestCancelExportTask(task.id);
		assert.equal(cancelled, true);
		assert.equal(getExportTask(task.id).status, "cancelling");
	});

	it("已结束任务不再触发取消处理器，状态不变", () => {
		const task = addExportTask({ fileName: "a.csv", format: "csv" });
		updateExportTask(task.id, { status: "done", finishedAt: 1 });
		let called = false;
		registerExportCancelHandler(task.id, () => {
			called = true;
		});
		requestCancelExportTask(task.id);
		assert.equal(called, false);
		assert.equal(getExportTask(task.id).status, "done");
	});

	it("writing 状态同样可取消", () => {
		const task = addExportTask({ fileName: "a.csv", format: "csv" });
		updateExportTask(task.id, { status: "writing" });
		requestCancelExportTask(task.id);
		assert.equal(getExportTask(task.id).status, "cancelling");
	});

	it("不存在的任务静默忽略", () => {
		assert.doesNotThrow(() => requestCancelExportTask("nope"));
	});
});

describe("clearFinishedExportTasks", () => {
	it("清除 done/error/cancelled，保留活动任务", () => {
		const running = addExportTask({ fileName: "r.csv", format: "csv" });
		const writing = addExportTask({ fileName: "w.csv", format: "csv" });
		updateExportTask(writing.id, { status: "writing" });
		const cancelling = addExportTask({ fileName: "c.csv", format: "csv" });
		updateExportTask(cancelling.id, { status: "cancelling" });
		const done = addExportTask({ fileName: "d.csv", format: "csv" });
		updateExportTask(done.id, { status: "done", finishedAt: 1 });
		const error = addExportTask({ fileName: "e.csv", format: "csv" });
		updateExportTask(error.id, { status: "error", finishedAt: 1 });
		const cancelled = addExportTask({ fileName: "x.csv", format: "csv" });
		updateExportTask(cancelled.id, { status: "cancelled", finishedAt: 1 });

		clearFinishedExportTasks();

		const remaining = getExportTasks().map((t) => t.id);
		assert.deepEqual(remaining.sort(), [running.id, writing.id, cancelling.id].sort());
		assert.equal(getExportTask(done.id), null);
		assert.equal(getExportTask(error.id), null);
		assert.equal(getExportTask(cancelled.id), null);
	});
});
