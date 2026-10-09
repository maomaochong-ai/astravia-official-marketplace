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
	getExportPayload,
	hasExportPayload,
	isExportTaskActive,
	isExportTaskPending,
	MAX_UNSAVED_EXPORTS,
	registerExportCancelHandler,
	releaseExportPayload,
	removeExportTask,
	requestCancelExportTask,
	subscribeExportTasks,
	updateExportTask,
	stageExportPayload,
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

	describe("clearFinishedExportTasks / 未保存记录", () => {
		it("保留 unsaved（及其暂存内容），只清 done / error / cancelled", () => {
			const unsaved = addExportTask({ fileName: "u.csv", format: "csv" });
			updateExportTask(unsaved.id, { status: "unsaved", finishedAt: 1 });
			stageExportPayload(unsaved.id, { fileName: "u.csv", content: "a,b\n1,2\n", encoding: "utf8" });
			const done = addExportTask({ fileName: "d.csv", format: "csv" });
			updateExportTask(done.id, { status: "done", finishedAt: 1 });

			clearFinishedExportTasks();

			assert.equal(getExportTask(unsaved.id).status, "unsaved");
			assert.equal(hasExportPayload(unsaved.id), true);
			assert.equal(getExportTask(done.id), null);
		});
	});

	describe("导出暂存区", () => {
		it("stage / get / release 往返", () => {
			const task = addExportTask({ fileName: "a.csv", format: "csv" });
			assert.equal(hasExportPayload(task.id), false);
			assert.equal(getExportPayload(task.id), null);

			stageExportPayload(task.id, { fileName: "a.csv", content: "x", encoding: "base64" });
			assert.equal(hasExportPayload(task.id), true);
			assert.deepEqual(getExportPayload(task.id), { fileName: "a.csv", content: "x", encoding: "base64" });

			releaseExportPayload(task.id);
			assert.equal(hasExportPayload(task.id), false);
		});

		it("同 id 重复暂存以最后一次为准", () => {
			const task = addExportTask({ fileName: "a.csv", format: "csv" });
			stageExportPayload(task.id, { fileName: "a.csv", content: "old", encoding: "utf8" });
			stageExportPayload(task.id, { fileName: "a.csv", content: "new", encoding: "utf8" });
			assert.equal(getExportPayload(task.id).content, "new");
			assert.equal(MAX_UNSAVED_EXPORTS, 3);
		});

		it("移除任务时一并释放暂存内容", () => {
			const task = addExportTask({ fileName: "a.csv", format: "csv" });
			stageExportPayload(task.id, { fileName: "a.csv", content: "x", encoding: "utf8" });
			removeExportTask(task.id);
			assert.equal(hasExportPayload(task.id), false);
		});

		it("超出上限淘汰最早的未保存内容，对应任务落成已取消并留痕", () => {
			const tasks = ["a", "b", "c", "d"].map((name) => {
				const task = addExportTask({ fileName: `${name}.csv`, format: "csv" });
				updateExportTask(task.id, { status: "unsaved", finishedAt: 1 });
				return task;
			});
			for (const task of tasks.slice(0, MAX_UNSAVED_EXPORTS)) {
				stageExportPayload(task.id, { fileName: task.fileName, content: "x", encoding: "utf8" });
			}
			// 第 4 份触发淘汰：最早的一份被释放，用户能从上一条记录里看到原因。
			stageExportPayload(tasks[3].id, { fileName: "d.csv", content: "y", encoding: "utf8" });

			assert.equal(hasExportPayload(tasks[0].id), false);
			assert.equal(getExportTask(tasks[0].id).status, "cancelled");
			assert.match(getExportTask(tasks[0].id).note, /导出内容已释放/);
			for (const task of tasks.slice(1)) assert.equal(hasExportPayload(task.id), true);
		});

		it("等待保存的内容不会被淘汰（原生保存框还开着）", () => {
			const tasks = ["a", "b", "c", "d"].map((name) => {
				const task = addExportTask({ fileName: `${name}.csv`, format: "csv" });
				updateExportTask(task.id, { status: "awaiting-save" });
				return task;
			});
			for (const task of tasks) stageExportPayload(task.id, { fileName: task.fileName, content: "x", encoding: "utf8" });

			for (const task of tasks) {
				assert.equal(hasExportPayload(task.id), true);
				assert.equal(getExportTask(task.id).status, "awaiting-save");
			}
		});
	});

	describe("isExportTaskActive / isExportTaskPending", () => {
		it("活动 = running / writing / cancelling", () => {
			assert.equal(isExportTaskActive({ status: "running" }), true);
			assert.equal(isExportTaskActive({ status: "writing" }), true);
			assert.equal(isExportTaskActive({ status: "cancelling" }), true);
			for (const status of ["awaiting-save", "unsaved", "done", "error", "cancelled"]) {
				assert.equal(isExportTaskActive({ status }), false);
			}
		});

		it("未完成 = 活动 + 等待保存 + 未保存", () => {
			for (const status of ["running", "writing", "cancelling", "awaiting-save", "unsaved"]) {
				assert.equal(isExportTaskPending({ status }), true);
			}
			for (const status of ["done", "error", "cancelled"]) {
				assert.equal(isExportTaskPending({ status }), false);
			}
		});

		it("等待保存 / 未保存不再可取消（取消就是保存框的事）", () => {
			const waiting = addExportTask({ fileName: "w.csv", format: "csv" });
			updateExportTask(waiting.id, { status: "awaiting-save" });
			requestCancelExportTask(waiting.id);
			assert.equal(getExportTask(waiting.id).status, "awaiting-save");

			const unsaved = addExportTask({ fileName: "u.csv", format: "csv" });
			updateExportTask(unsaved.id, { status: "unsaved" });
			requestCancelExportTask(unsaved.id);
			assert.equal(getExportTask(unsaved.id).status, "unsaved");
		});
	});
