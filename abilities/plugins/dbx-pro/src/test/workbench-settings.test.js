/**
 * workbench-settings 纯逻辑测试 — 宽容解析、边界夹逼、出厂设置判定。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DEFAULT_SETTINGS,
	ENGINE_ROW_CAP,
	EXPORT_ROW_LIMIT_DEFAULT,
	EXPORT_ROW_LIMIT_MAX,
	EXPORT_ROW_LIMIT_MIN,
	EXPORT_BATCH_SIZE_DEFAULT,
	EXPORT_BATCH_SIZE_MAX,
	EXPORT_BATCH_SIZE_MIN,
	DEFAULT_TABLE_OPEN_PAGE_SIZE,
	QUERY_RESULT_MAX_ROWS_DEFAULT,
	QUERY_RESULT_MAX_ROWS_MAX,
	QUERY_RESULT_MAX_ROWS_MIN,
	MAX_RESULT_PAGE_SIZE,
	PAGE_SIZE_OPTIONS,
	SETTINGS_BOUNDS,
	isDefaultSettings,
	normalizeSettings,
	resolvePageSize,
} from "../domain/workbench-settings.ts";

describe("设置常量", () => {
	it("默认设置在边界内", () => {
		for (const key of ["queryTimeoutSecs", "rowLimit", "historyLimit", "exportRowLimit", "tableOpenPageSize", "exportBatchSize", "queryResultMaxRows"]) {
			const value = DEFAULT_SETTINGS[key];
			const { min, max } = SETTINGS_BOUNDS[key];
			assert.ok(value >= min && value <= max, `${key}=${value} 越界`);
		}
		// 默认每页行数是可选项之一，且不超过引擎硬上限。
		assert.ok(PAGE_SIZE_OPTIONS.includes(DEFAULT_SETTINGS.rowLimit));
		assert.ok(DEFAULT_SETTINGS.rowLimit <= ENGINE_ROW_CAP);
	});

	it("分页档位与 dbx 桌面壳一致：[50,100,500,1000] 共 4 档，无 10000", () => {
		assert.deepEqual([...PAGE_SIZE_OPTIONS], [50, 100, 500, 1000]);
		assert.ok(!PAGE_SIZE_OPTIONS.includes(10_000));
	});

	it("默认每页行数对齐 dbx = 100", () => {
		assert.equal(DEFAULT_SETTINGS.rowLimit, 100);
	});

	it("页大小上限对齐 dbx = 1_000_000", () => {
		assert.equal(MAX_RESULT_PAGE_SIZE, 1_000_000);
		assert.equal(SETTINGS_BOUNDS.rowLimit.max, 1_000_000);
	});

	it("导出限制默认关闭，上限默认 100_000，区间 100..2_147_483_647", () => {
		assert.equal(DEFAULT_SETTINGS.exportLimitEnabled, false);
		assert.equal(DEFAULT_SETTINGS.exportRowLimit, EXPORT_ROW_LIMIT_DEFAULT);
		assert.equal(EXPORT_ROW_LIMIT_DEFAULT, 100_000);
		assert.equal(EXPORT_ROW_LIMIT_MIN, 100);
		assert.equal(EXPORT_ROW_LIMIT_MAX, 2_147_483_647);
	});

	it("表预览默认行数对齐 dbx = 100", () => {
		assert.equal(DEFAULT_SETTINGS.tableOpenPageSize, DEFAULT_TABLE_OPEN_PAGE_SIZE);
		assert.equal(DEFAULT_TABLE_OPEN_PAGE_SIZE, 100);
	});

	it("导出每批取行数对齐 dbx = 2000，区间 100..100_000", () => {
		assert.equal(DEFAULT_SETTINGS.exportBatchSize, EXPORT_BATCH_SIZE_DEFAULT);
		assert.equal(EXPORT_BATCH_SIZE_DEFAULT, 2_000);
		assert.equal(EXPORT_BATCH_SIZE_MIN, 100);
		assert.equal(EXPORT_BATCH_SIZE_MAX, 100_000);
	});

	it("查询结果总量限制默认开启，上限默认 100_000，区间 1..2_147_483_647", () => {
		assert.equal(DEFAULT_SETTINGS.queryResultMaxRowsEnabled, true);
		assert.equal(DEFAULT_SETTINGS.queryResultMaxRows, QUERY_RESULT_MAX_ROWS_DEFAULT);
		assert.equal(QUERY_RESULT_MAX_ROWS_DEFAULT, 100_000);
		assert.equal(QUERY_RESULT_MAX_ROWS_MIN, 1);
		assert.equal(QUERY_RESULT_MAX_ROWS_MAX, 2_147_483_647);
	});

	it("ENGINE_ROW_CAP 为正数", () => {
		assert.ok(ENGINE_ROW_CAP > 0);
	});
});

describe("resolvePageSize", () => {
	it("合法整数原样返回", () => {
		assert.equal(resolvePageSize(200), 200);
	});
	it("超过 1_000_000 夹到上限", () => {
		assert.equal(resolvePageSize(2_000_000), 1_000_000);
	});
	it("坏值回落默认（默认页大小 100）", () => {
		assert.equal(resolvePageSize(0), DEFAULT_SETTINGS.rowLimit);
		assert.equal(resolvePageSize("x"), DEFAULT_SETTINGS.rowLimit);
		assert.equal(resolvePageSize(undefined), DEFAULT_SETTINGS.rowLimit);
	});
	it("支持显式 fallback（对齐 dbx normalizeResultPageSize 的 100）", () => {
		assert.equal(resolvePageSize(null, 100), 100);
	});
	it("小数截断", () => {
		assert.equal(resolvePageSize(33.9), 33);
	});
});

describe("normalizeSettings", () => {
	it("非对象输入回落到默认值", () => {
		for (const raw of [null, undefined, "x", 42, []]) {
			assert.deepEqual(normalizeSettings(raw), { ...DEFAULT_SETTINGS });
		}
	});

	it("合法字段保留", () => {
		const result = normalizeSettings({
			queryTimeoutSecs: 30,
			rowLimit: 50,
			historyEnabled: false,
			historyLimit: 100,
		});
		assert.equal(result.queryTimeoutSecs, 30);
		assert.equal(result.rowLimit, 50);
		assert.equal(result.historyEnabled, false);
		assert.equal(result.historyLimit, 100);
	});

	it("超上限夹到上限", () => {
		const result = normalizeSettings({
			queryTimeoutSecs: 10_000,
			rowLimit: 10_000_000,
			historyLimit: 1_000_000,
			exportRowLimit: 9_999_999_999,
		});
		assert.equal(result.queryTimeoutSecs, SETTINGS_BOUNDS.queryTimeoutSecs.max);
		assert.equal(result.rowLimit, SETTINGS_BOUNDS.rowLimit.max);
		assert.equal(result.historyLimit, SETTINGS_BOUNDS.historyLimit.max);
		assert.equal(result.exportRowLimit, SETTINGS_BOUNDS.exportRowLimit.max);
	});

	it("低于下限夹到下限", () => {
		const result = normalizeSettings({
			queryTimeoutSecs: -5,
			rowLimit: 0,
			historyLimit: -10,
			exportRowLimit: 1,
		});
		assert.equal(result.queryTimeoutSecs, SETTINGS_BOUNDS.queryTimeoutSecs.min);
		assert.equal(result.rowLimit, SETTINGS_BOUNDS.rowLimit.min);
		assert.equal(result.historyLimit, SETTINGS_BOUNDS.historyLimit.min);
		assert.equal(result.exportRowLimit, SETTINGS_BOUNDS.exportRowLimit.min);
	});

	it("导出限制字段宽容解析", () => {
		const enabled = normalizeSettings({ exportLimitEnabled: true, exportRowLimit: "5000" });
		assert.equal(enabled.exportLimitEnabled, true);
		assert.equal(enabled.exportRowLimit, 5000);
		// 坏值回落默认。
		const broken = normalizeSettings({ exportLimitEnabled: "yes", exportRowLimit: NaN });
		assert.equal(broken.exportLimitEnabled, DEFAULT_SETTINGS.exportLimitEnabled);
		assert.equal(broken.exportRowLimit, DEFAULT_SETTINGS.exportRowLimit);
		// 缺字段补齐默认。
		const missing = normalizeSettings({ rowLimit: 50 });
		assert.equal(missing.exportLimitEnabled, false);
		assert.equal(missing.exportRowLimit, EXPORT_ROW_LIMIT_DEFAULT);
	});

	it("新增字段宽容解析", () => {
		const result = normalizeSettings({
			tableOpenPageSize: 200,
			exportBatchSize: 5000,
			queryResultMaxRowsEnabled: false,
			queryResultMaxRows: 50000,
		});
		assert.equal(result.tableOpenPageSize, 200);
		assert.equal(result.exportBatchSize, 5000);
		assert.equal(result.queryResultMaxRowsEnabled, false);
		assert.equal(result.queryResultMaxRows, 50000);
		// 坏值回落默认。
		const broken = normalizeSettings({
			tableOpenPageSize: "abc",
			exportBatchSize: NaN,
			queryResultMaxRowsEnabled: "yes",
			queryResultMaxRows: null,
		});
		assert.equal(broken.tableOpenPageSize, DEFAULT_SETTINGS.tableOpenPageSize);
		assert.equal(broken.exportBatchSize, DEFAULT_SETTINGS.exportBatchSize);
		assert.equal(broken.queryResultMaxRowsEnabled, DEFAULT_SETTINGS.queryResultMaxRowsEnabled);
		// Number(null)===0 → 夹到下限。
		assert.equal(broken.queryResultMaxRows, SETTINGS_BOUNDS.queryResultMaxRows.min);
		// 缺字段补齐默认。
		const missing = normalizeSettings({ rowLimit: 50 });
		assert.equal(missing.tableOpenPageSize, DEFAULT_TABLE_OPEN_PAGE_SIZE);
		assert.equal(missing.exportBatchSize, EXPORT_BATCH_SIZE_DEFAULT);
		assert.equal(missing.queryResultMaxRowsEnabled, true);
		assert.equal(missing.queryResultMaxRows, QUERY_RESULT_MAX_ROWS_DEFAULT);
	});

	it("非数字 / NaN 回落默认值；null 夹到下限", () => {
		const result = normalizeSettings({
			queryTimeoutSecs: "abc",
			rowLimit: NaN,
			historyLimit: null,
			historyEnabled: "no",
		});
		assert.equal(result.queryTimeoutSecs, DEFAULT_SETTINGS.queryTimeoutSecs);
		assert.equal(result.rowLimit, DEFAULT_SETTINGS.rowLimit);
		// Number(null)===0 → 夹到下限，不回落。
		assert.equal(result.historyLimit, SETTINGS_BOUNDS.historyLimit.min);
		assert.equal(result.historyEnabled, DEFAULT_SETTINGS.historyEnabled);
	});

	it("小数截断为整数", () => {
		const result = normalizeSettings({ queryTimeoutSecs: 12.9, rowLimit: 33.6 });
		assert.equal(result.queryTimeoutSecs, 12);
		assert.equal(result.rowLimit, 33);
	});

	it("schemaVersion 恒为 1", () => {
		assert.equal(normalizeSettings({ schemaVersion: 99 }).schemaVersion, 1);
	});
});

describe("isDefaultSettings", () => {
	it("默认设置 → true", () => {
		assert.equal(isDefaultSettings(DEFAULT_SETTINGS), true);
	});
	it("任一字段不同 → false", () => {
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, queryTimeoutSecs: 30 }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, historyEnabled: false }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, exportLimitEnabled: true }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, exportRowLimit: 5000 }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, tableOpenPageSize: 200 }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, exportBatchSize: 5000 }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, queryResultMaxRowsEnabled: false }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, queryResultMaxRows: 50000 }),
			false,
		);
	});
});
