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
	parsePageSizeInput,
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

	it("分页档位覆盖到 5000 行/页，用户自定义的 2000 / 5000 不再被静默改回 1000", () => {
		assert.deepEqual([...PAGE_SIZE_OPTIONS], [50, 100, 500, 1000, 2000, 5000]);
		assert.ok(!PAGE_SIZE_OPTIONS.includes(10_000));
	});

	it("默认每页行数对齐 dbx = 100", () => {
		assert.equal(DEFAULT_SETTINGS.rowLimit, 100);
	});

	it("页大小上限对齐 dbx 桌面壳 1_000_000（引擎单次硬上限 1000，超出部分分块拼页）", () => {
		assert.equal(MAX_RESULT_PAGE_SIZE, 1_000_000);
		assert.equal(SETTINGS_BOUNDS.rowLimit.max, MAX_RESULT_PAGE_SIZE);
		assert.equal(SETTINGS_BOUNDS.tableOpenPageSize.max, MAX_RESULT_PAGE_SIZE);
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

	it("查询结果总量限制默认关闭（不再拿 100_000 充当总行数），上限默认 100_000，区间 1..2_147_483_647", () => {
		assert.equal(DEFAULT_SETTINGS.queryResultMaxRowsEnabled, false);
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
	it("超过页大小上限夹到 MAX_RESULT_PAGE_SIZE，档位内的 2000 / 5000 / 100000 原样保留", () => {
		assert.equal(resolvePageSize(2_000_000), MAX_RESULT_PAGE_SIZE);
		// 回归：自定义页大小曾被夹到 ENGINE_ROW_CAP，用户选 2000 会静默变 1000。
		assert.equal(resolvePageSize(2_000), 2_000);
		assert.equal(resolvePageSize(5_000), 5_000);
		assert.equal(resolvePageSize(100_000), 100_000);
	});
	it("自定义页大小经 normalizeSettings 后不被改写", () => {
		assert.equal(normalizeSettings({ rowLimit: 2_000 }).rowLimit, 2_000);
		assert.equal(normalizeSettings({ tableOpenPageSize: 5_000 }).tableOpenPageSize, 5_000);
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

/**
 * 用户输入「每页行数」时的解析结果。界面不再静默改数，所以除了最终取值，
 * 还必须能区分「超上限」「低于下限」，才能给出对应的提示文案。
 */
describe("parsePageSizeInput", () => {
	it("区间内原样保留，不报越界", () => {
		for (const raw of ["50", "100", "2000", "5000", "10", "2000.7"]) {
			const parsed = parsePageSizeInput(raw, DEFAULT_SETTINGS.rowLimit);
			assert.equal(parsed.exceededMax, false, raw);
			assert.equal(parsed.belowMin, false, raw);
		}
		// 往返：底栏下拉里敲 2000（曾被静默改回 1000）。
		assert.equal(parsePageSizeInput("2000", 100).value, 2_000);
		assert.equal(parsePageSizeInput("2000.7", 100).value, 2_000);
	});

	it("超上限：取上限并标记 exceededMax", () => {
		const parsed = parsePageSizeInput("2000000", 100);
		assert.equal(parsed.value, MAX_RESULT_PAGE_SIZE);
		assert.equal(parsed.exceededMax, true);
		assert.equal(parsed.belowMin, false);
	});

	it("刚好等于上限不算越界", () => {
		const parsed = parsePageSizeInput(String(MAX_RESULT_PAGE_SIZE), 100);
		assert.equal(parsed.value, MAX_RESULT_PAGE_SIZE);
		assert.equal(parsed.exceededMax, false);
	});

	it("低于下限：保留原值并标记 belowMin", () => {
		for (const raw of ["0", "-5", "0.4"]) {
			const parsed = parsePageSizeInput(raw, 500);
			assert.equal(parsed.value, 500, raw);
			assert.equal(parsed.belowMin, true, raw);
			assert.equal(parsed.exceededMax, false, raw);
		}
	});

	it("空值与坏值：按原值处理，不报越界", () => {
		for (const raw of ["", "   ", "x", "1e", "-", "上"]) {
			const parsed = parsePageSizeInput(raw, 300);
			assert.equal(parsed.value, 300, JSON.stringify(raw));
			assert.equal(parsed.exceededMax, false, JSON.stringify(raw));
			assert.equal(parsed.belowMin, false, JSON.stringify(raw));
		}
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
		assert.equal(missing.queryResultMaxRowsEnabled, false);
		assert.equal(missing.queryResultMaxRows, QUERY_RESULT_MAX_ROWS_DEFAULT);
	});

	it("对齐 dbx 桌面壳的新增布尔设置默认值", () => {
		assert.equal(DEFAULT_SETTINGS.infiniteScroll, false);
		assert.equal(DEFAULT_SETTINGS.dataGridStripedRows, true);
		assert.equal(DEFAULT_SETTINGS.dataGridCrosshairHighlight, false);
		assert.equal(DEFAULT_SETTINGS.dataGridCellDetailButtonVisible, true);
		assert.equal(DEFAULT_SETTINGS.showResultSourceDatabase, true);
	});

	it("对齐 dbx 桌面壳的新增枚举设置默认值", () => {
		assert.equal(DEFAULT_SETTINGS.multiStatementDefaultView, "result");
		assert.equal(DEFAULT_SETTINGS.defaultExplainView, "table");
		assert.equal(DEFAULT_SETTINGS.resultTabNamingMode, "source");
	});

	it("新增布尔设置宽容解析", () => {
		const result = normalizeSettings({
			infiniteScroll: true,
			dataGridStripedRows: false,
			dataGridCrosshairHighlight: true,
			dataGridCellDetailButtonVisible: false,
			showResultSourceDatabase: false,
		});
		assert.equal(result.infiniteScroll, true);
		assert.equal(result.dataGridStripedRows, false);
		assert.equal(result.dataGridCrosshairHighlight, true);
		assert.equal(result.dataGridCellDetailButtonVisible, false);
		assert.equal(result.showResultSourceDatabase, false);
		// 坏值回落默认。
		const broken = normalizeSettings({
			infiniteScroll: 1,
			dataGridStripedRows: null,
		});
		assert.equal(broken.autoCalculateTotalRows, DEFAULT_SETTINGS.autoCalculateTotalRows);
		assert.equal(broken.infiniteScroll, DEFAULT_SETTINGS.infiniteScroll);
		assert.equal(broken.dataGridStripedRows, DEFAULT_SETTINGS.dataGridStripedRows);
	});

	it("新增枚举设置宽容解析", () => {
		const result = normalizeSettings({
			multiStatementDefaultView: "messages",
			defaultExplainView: "canvas",
			resultTabNamingMode: "table",
		});
		assert.equal(result.multiStatementDefaultView, "messages");
		assert.equal(result.defaultExplainView, "canvas");
		assert.equal(result.resultTabNamingMode, "table");
		// 非法枚举值回落默认。
		const broken = normalizeSettings({
			multiStatementDefaultView: "invalid",
			defaultExplainView: "bad",
			resultTabNamingMode: "wrong",
		});
		assert.equal(broken.multiStatementDefaultView, DEFAULT_SETTINGS.multiStatementDefaultView);
		assert.equal(broken.defaultExplainView, DEFAULT_SETTINGS.defaultExplainView);
		assert.equal(broken.resultTabNamingMode, DEFAULT_SETTINGS.resultTabNamingMode);
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
			isDefaultSettings({ ...DEFAULT_SETTINGS, queryResultMaxRowsEnabled: true }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, queryResultMaxRows: 50000 }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, infiniteScroll: true }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, infiniteScroll: true }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, dataGridStripedRows: false }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, dataGridCrosshairHighlight: true }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, multiStatementDefaultView: "messages" }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, defaultExplainView: "canvas" }),
			false,
		);
		assert.equal(
			isDefaultSettings({ ...DEFAULT_SETTINGS, resultTabNamingMode: "table" }),
			false,
		);
	});
});
