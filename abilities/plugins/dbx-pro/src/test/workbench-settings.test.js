/**
 * workbench-settings 纯逻辑测试 — 宽容解析、边界夹逼、出厂设置判定。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DEFAULT_SETTINGS,
	ENGINE_ROW_CAP,
	SETTINGS_BOUNDS,
	isDefaultSettings,
	normalizeSettings,
} from "../domain/workbench-settings.ts";

describe("设置常量", () => {
	it("默认设置在边界内", () => {
		for (const key of ["queryTimeoutSecs", "rowLimit", "historyLimit"]) {
			const value = DEFAULT_SETTINGS[key];
			const { min, max } = SETTINGS_BOUNDS[key];
			assert.ok(value >= min && value <= max, `${key}=${value} 越界`);
		}
		assert.equal(DEFAULT_SETTINGS.rowLimit, ENGINE_ROW_CAP);
	});

	it("ENGINE_ROW_CAP 为正数", () => {
		assert.ok(ENGINE_ROW_CAP > 0);
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
			rowLimit: 100_000,
			historyLimit: 1_000_000,
		});
		assert.equal(result.queryTimeoutSecs, SETTINGS_BOUNDS.queryTimeoutSecs.max);
		assert.equal(result.rowLimit, SETTINGS_BOUNDS.rowLimit.max);
		assert.equal(result.historyLimit, SETTINGS_BOUNDS.historyLimit.max);
	});

	it("低于下限夹到下限", () => {
		const result = normalizeSettings({
			queryTimeoutSecs: -5,
			rowLimit: 0,
			historyLimit: -10,
		});
		assert.equal(result.queryTimeoutSecs, SETTINGS_BOUNDS.queryTimeoutSecs.min);
		assert.equal(result.rowLimit, SETTINGS_BOUNDS.rowLimit.min);
		assert.equal(result.historyLimit, SETTINGS_BOUNDS.historyLimit.min);
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
	});
});
