/**
 * 「导出全部数据」取数循环的行为回归。
 *
 * 把循环抽成 runExportAll 就是为了能在这里驱动两条真实缺陷：
 * 1. 取消必须在一「块」内生效（一块 = 一次引擎请求）。历史实现只在整批边界检查
 *    取消，而 batchSize 可能是 50000 行 = 最多 50 次请求，用户看到「正在取消」挂
 *    十几分钟。
 * 2. 数据取完要按引擎信号显式判定，并在实导出少于统计总数时把差额说清楚，
 *    否则「只导出前 N 行」会被当成完整结果。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_ROW_CAP } from "../domain/workbench-settings.ts";
import { runExportAll } from "../features/database-workspace/services/export-all-runner.ts";

/** 造一页引擎响应：size 为本页行数。 */
function makePage(size, { paged = true, truncated = false } = {}) {
	return {
		columns: ["id"],
		rows: Array.from({ length: size }, (_, i) => ({ id: i + 1 })),
		paged,
		truncated,
	};
}

/** 按 sizes 依次返回指定行数的页；用完后重复最后一个尺寸。 */
function scriptedFetch(sizes, { onCall, paged = true, truncated = false } = {}) {
	const calls = [];
	let index = 0;
	return {
		calls,
		fetchPage: async (request) => {
			calls.push(request);
			const size = sizes[Math.min(index, sizes.length - 1)];
			index += 1;
			onCall?.(index, request);
			return makePage(size, { paged, truncated });
		},
	};
}

/** 默认选项：不限行数、2000 行一批、总数未知。 */
function options(overrides) {
	return {
		kind: "csv",
		tableName: "t",
		dialect: "standard",
		rowLimit: Infinity,
		batchSize: 2_000,
		knownTotal: null,
		token: { cancelled: false },
		...overrides,
	};
}

describe("runExportAll 取消", () => {
	it("取消在一次引擎请求内生效，不等整批取完", async () => {
		const token = { cancelled: false };
		// 每批 5000 行 = 5 块；第 1 块返回后用户点了取消。
		const scripted = scriptedFetch([ENGINE_ROW_CAP], {
			onCall: (call) => {
				if (call === 1) token.cancelled = true;
			},
		});

		const result = await runExportAll(
			options({ batchSize: 5_000, fetchPage: scripted.fetchPage, token }),
		);

		assert.equal(result.cancelled, true);
		// 旧实现要等整批 5 块跑完才退出，这里第 2 块之前就返回。
		assert.equal(scripted.calls.length, 1);
		// 未取完的批不算已导出：调用方只落取消态，不写文件。
		assert.equal(result.total, 0);
	});

	it("取消后不产生差额提示（未完成不算结果）", async () => {
		const token = { cancelled: true };
		const scripted = scriptedFetch([ENGINE_ROW_CAP]);

		const result = await runExportAll(
			options({ knownTotal: 100_000, fetchPage: scripted.fetchPage, token }),
		);

		assert.equal(result.cancelled, true);
		assert.equal(scripted.calls.length, 0);
		assert.equal(result.truncationNote, null);
	});
});

describe("runExportAll 分块取数", () => {
	it("每块按引擎单次上限请求，offset 连续且取完即止", async () => {
		const scripted = scriptedFetch([ENGINE_ROW_CAP, ENGINE_ROW_CAP, 400]);

		const result = await runExportAll(options({ fetchPage: scripted.fetchPage }));

		assert.deepEqual(scripted.calls, [
			{ offset: 0, limit: ENGINE_ROW_CAP },
			{ offset: ENGINE_ROW_CAP, limit: ENGINE_ROW_CAP },
			{ offset: 2 * ENGINE_ROW_CAP, limit: ENGINE_ROW_CAP },
		]);
		// 第 3 块没取满 → 数据已到末尾，不再发第 4 次请求。
		assert.equal(result.total, 2_400);
		assert.equal(result.cancelled, false);
	});

	it("每取完一批回调一次累计行数", async () => {
		const progress = [];
		const scripted = scriptedFetch([ENGINE_ROW_CAP, ENGINE_ROW_CAP, 400]);

		await runExportAll(
			options({ fetchPage: scripted.fetchPage, onProgress: (n) => progress.push(n) }),
		);

		assert.deepEqual(progress, [2_000, 2_400]);
	});

	it("csv 走增量文本，xlsx 收集全部行", async () => {
		const csv = await runExportAll(
			options({ fetchPage: scriptedFetch([ENGINE_ROW_CAP, 400]).fetchPage }),
		);
		assert.ok(csv.stream);
		assert.match(csv.stream.content(), /id/);
		assert.equal(csv.xlsxRows.length, 0);

		const xlsx = await runExportAll(
			options({ kind: "xlsx", fetchPage: scriptedFetch([ENGINE_ROW_CAP, 400]).fetchPage }),
		);
		assert.equal(xlsx.stream, null);
		assert.equal(xlsx.xlsxRows.length, 1_400);
	});
});

describe("runExportAll 结束条件", () => {
	it("设置的导出行数上限生效并给出上限提示", async () => {
		const scripted = scriptedFetch([ENGINE_ROW_CAP, 500]);

		const result = await runExportAll(
			options({ rowLimit: 1_500, fetchPage: scripted.fetchPage }),
		);

		assert.equal(result.total, 1_500);
		assert.equal(scripted.calls.length, 2);
		assert.ok(result.truncationNote?.includes("导出行数上限"));
	});

	it("不可分页 SQL 只取一次并说明截断", async () => {
		const scripted = scriptedFetch([ENGINE_ROW_CAP], { paged: false, truncated: true });

		const result = await runExportAll(options({ fetchPage: scripted.fetchPage }));

		assert.equal(scripted.calls.length, 1);
		assert.equal(result.total, ENGINE_ROW_CAP);
		assert.ok(result.truncationNote?.includes("不支持服务端分页"));
	});

	it("实导出少于统计总数时说明差额", async () => {
		const scripted = scriptedFetch([ENGINE_ROW_CAP, 400]);

		const result = await runExportAll(
			options({ knownTotal: 100_000, fetchPage: scripted.fetchPage }),
		);

		assert.equal(result.total, 1_400);
		assert.ok(result.truncationNote?.includes(`实导出 ${(1_400).toLocaleString()} 行`));
		assert.ok(result.truncationNote?.includes(`统计总数 ${(100_000).toLocaleString()} 行`));
	});

	it("取满统计总数时不报差额", async () => {
		const scripted = scriptedFetch([ENGINE_ROW_CAP, 400]);

		const result = await runExportAll(
			options({ knownTotal: 1_400, fetchPage: scripted.fetchPage }),
		);

		assert.equal(result.total, 1_400);
		assert.equal(result.truncationNote, null);
	});
});
