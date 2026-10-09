/**
 * export-save 状态机测试 —— 「导出全部数据」落盘阶段的可追溯性。
 *
 * 历史缺陷：内容取完好几个 G 之后才弹保存框，用户点取消就只留下一条
 * 「未选择保存位置，已取消导出」，内容已丢、记录也追溯不到。现在的合同是：
 * 内容先暂存，取消保存后任务落到 unsaved 且内容仍在，可以重新保存或明确放弃；
 * 保存失败同样保留内容，允许直接重试而不必重跑查询。
 *
 * 宿主 fs 能力用 setRuntime 注入假 ctx，不依赖真实桌面进程。
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { discardStagedExport, saveStagedExport } from "../features/database-workspace/services/export-save.ts";
import {
	addExportTask,
	getExportPayload,
	getExportTask,
	getExportTasks,
	hasExportPayload,
	removeExportTask,
	stageExportPayload,
} from "../features/database-workspace/state/export-tasks-store.ts";
import { clearRuntime, setRuntime } from "../runtime-contract.ts";

const FILENAME = "demo.t.csv";
const CONTENT = "id\n1\n";
const PATH = "/Users/me/Downloads/demo.t.csv";

/** 注入带 fs.saveAs 的宿主上下文；saveAs 行为由用例决定。 */
function activateWith(saveAs) {
	setRuntime({ fs: { saveAs } });
}

/** 建一个已暂存内容的导出任务（相当于取数完成、准备落盘）。 */
function makeStagedTask() {
	const task = addExportTask({ fileName: FILENAME, format: "csv" });
	stageExportPayload(task.id, { fileName: FILENAME, content: CONTENT, encoding: "utf8" });
	return task;
}

beforeEach(() => {
	for (const task of getExportTasks()) removeExportTask(task.id);
	clearRuntime();
});

describe("saveStagedExport：成功落盘", () => {
	it("交给宿主 saveAs 并落完成态，真实路径可 reveal", async () => {
		const task = makeStagedTask();
		let received = null;
		activateWith(async (fileName, content, encoding, options) => {
			received = { fileName, content, encoding, options };
			return PATH;
		});

		const result = await saveStagedExport(task.id);

		assert.deepEqual(result, { outcome: "saved", filePath: PATH });
		assert.equal(received.fileName, FILENAME);
		assert.equal(received.content, CONTENT);
		assert.equal(received.encoding, "utf8");
		assert.equal(received.options.title, "选择导出文件保存位置");

		const updated = getExportTask(task.id);
		assert.equal(updated.status, "done");
		assert.equal(updated.filePath, PATH);
		assert.equal(updated.note, null);
		assert.equal(updated.errorMessage, null);
		assert.ok(updated.finishedAt > 0);
		// 已落盘的内容不再占内存。
		assert.equal(hasExportPayload(task.id), false);
	});

	it("保存框打开期间任务是 awaiting-save（弹窗据此禁止关闭）", async () => {
		const task = makeStagedTask();
		let seenDuringSave = null;
		activateWith(async () => {
			seenDuringSave = getExportTask(task.id).status;
			return PATH;
		});

		await saveStagedExport(task.id);

		assert.equal(seenDuringSave, "awaiting-save");
	});
});

describe("saveStagedExport：用户取消保存", () => {
	it("落到 unsaved，内容保留可重新选择保存位置", async () => {
		const task = makeStagedTask();
		activateWith(async () => null);

		const result = await saveStagedExport(task.id);

		assert.deepEqual(result, { outcome: "unsaved" });
		const updated = getExportTask(task.id);
		assert.equal(updated.status, "unsaved");
		assert.match(updated.note, /已保留导出内容/);
		assert.ok(updated.finishedAt > 0);
		assert.equal(getExportPayload(task.id).content, CONTENT);
	});

	it("重新保存成功后就地转完成态，不再残留未保存提示", async () => {
		const task = makeStagedTask();
		let attempt = 0;
		activateWith(async () => {
			attempt += 1;
			return attempt === 1 ? null : PATH;
		});

		assert.equal((await saveStagedExport(task.id)).outcome, "unsaved");
		assert.equal((await saveStagedExport(task.id)).outcome, "saved");

		const updated = getExportTask(task.id);
		assert.equal(updated.status, "done");
		assert.equal(updated.filePath, PATH);
		assert.equal(updated.note, null);
		assert.equal(hasExportPayload(task.id), false);
	});
});

describe("saveStagedExport：失败与不可用", () => {
	it("宿主写盘失败时保留内容，便于直接重试", async () => {
		const task = makeStagedTask();
		activateWith(async () => {
			throw new Error("EACCES: permission denied");
		});

		const result = await saveStagedExport(task.id);

		assert.equal(result.outcome, "error");
		assert.match(result.message, /EACCES/);
		const updated = getExportTask(task.id);
		assert.equal(updated.status, "error");
		assert.match(updated.errorMessage, /EACCES/);
		assert.match(updated.note, /已保留导出内容/);
		// 失败不能把内容丢掉：重试时不该再跑一遍查询。
		assert.equal(hasExportPayload(task.id), true);
	});

	it("没有暂存内容时返回 unavailable，不改动任务状态", async () => {
		const task = addExportTask({ fileName: FILENAME, format: "csv" });
		activateWith(async () => PATH);

		assert.deepEqual(await saveStagedExport(task.id), { outcome: "unavailable" });
		assert.equal(getExportTask(task.id).status, "running");
	});

	it("宿主没有 fs.saveAs 时返回 unavailable，由调用方降级下载", async () => {
		const task = makeStagedTask();
		setRuntime({});

		assert.deepEqual(await saveStagedExport(task.id), { outcome: "unavailable" });
		assert.equal(getExportTask(task.id).status, "running");
	});

	it("运行时已释放（插件 dispose）时返回 unavailable 而不是抛错", async () => {
		const task = makeStagedTask();

		assert.deepEqual(await saveStagedExport(task.id), { outcome: "unavailable" });
		assert.equal(hasExportPayload(task.id), true);
	});
});

describe("discardStagedExport", () => {
	it("释放内容并把任务落成已取消，留痕说明原因", () => {
		const task = makeStagedTask();

		discardStagedExport(task.id);

		const updated = getExportTask(task.id);
		assert.equal(updated.status, "cancelled");
		assert.match(updated.note, /已放弃保存/);
		assert.ok(updated.finishedAt > 0);
		assert.equal(hasExportPayload(task.id), false);
	});

	it("内容已被淘汰 / 已落盘时只落状态，不抛错", () => {
		const task = addExportTask({ fileName: FILENAME, format: "csv" });
		assert.doesNotThrow(() => discardStagedExport(task.id));
		assert.equal(getExportTask(task.id).status, "cancelled");
	});
});
