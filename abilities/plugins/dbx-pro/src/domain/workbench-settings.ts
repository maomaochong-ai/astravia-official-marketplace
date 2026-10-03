/**
 * 工作台设置 —— 纯逻辑层（不导入 SDK，可被 `node --test` 直接导入）。
 *
 * 存储副作用在 `workbench-settings-store.ts`。
 * 架构口径：读取走 dbx-mcp；写 / DDL 走自研驱动，并在【每次执行前】弹窗确认，
 * 因此这里不再需要全局「写开关」或「CLI 回退路径」等历史概念。
 * 所有字段都做「宽容解析 + 夹逼」，坏值不会让面板崩：读不到就用默认值。
 */

import { clampInt, HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX, HISTORY_LIMIT_MIN } from "./query-history";

export interface WorkbenchSettings {
	schemaVersion: 1;
	/** 查询超时（秒）。 */
	queryTimeoutSecs: number;
	/** 结果行数上限（按行截断，不会改写 SQL）。 */
	rowLimit: number;
	/** 是否记录查询历史。 */
	historyEnabled: boolean;
	/** 历史条数上限。 */
	historyLimit: number;
}

/** 数值字段的边界（UI 的 min/max 必须取自这里，避免两处写死）。 */
export const SETTINGS_BOUNDS = Object.freeze({
	queryTimeoutSecs: { min: 1, max: 600 },
	rowLimit: { min: 1, max: 100_000 },
	historyLimit: { min: HISTORY_LIMIT_MIN, max: HISTORY_LIMIT_MAX },
});

export const DEFAULT_SETTINGS: WorkbenchSettings = Object.freeze({
	schemaVersion: 1,
	queryTimeoutSecs: 60,
	rowLimit: 1000,
	historyEnabled: true,
	historyLimit: HISTORY_LIMIT_DEFAULT,
});

/** 宽容解析设置：非对象 / 坏字段一律回落到默认值，数值夹逼到合法区间。 */
export function normalizeSettings(raw: unknown): WorkbenchSettings {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
	const source = raw as Record<string, unknown>;
	return {
		schemaVersion: 1,
		queryTimeoutSecs: clampInt(
			source.queryTimeoutSecs,
			SETTINGS_BOUNDS.queryTimeoutSecs.min,
			SETTINGS_BOUNDS.queryTimeoutSecs.max,
			DEFAULT_SETTINGS.queryTimeoutSecs,
		),
		rowLimit: clampInt(
			source.rowLimit,
			SETTINGS_BOUNDS.rowLimit.min,
			SETTINGS_BOUNDS.rowLimit.max,
			DEFAULT_SETTINGS.rowLimit,
		),
		historyEnabled:
			typeof source.historyEnabled === "boolean"
				? source.historyEnabled
				: DEFAULT_SETTINGS.historyEnabled,
		historyLimit: clampInt(
			source.historyLimit,
			SETTINGS_BOUNDS.historyLimit.min,
			SETTINGS_BOUNDS.historyLimit.max,
			DEFAULT_SETTINGS.historyLimit,
		),
	};
}

/** 判断是否仍为出厂设置（设置页用来展示「恢复默认」是否有效）。 */
export function isDefaultSettings(settings: WorkbenchSettings): boolean {
	return (
		settings.queryTimeoutSecs === DEFAULT_SETTINGS.queryTimeoutSecs &&
		settings.rowLimit === DEFAULT_SETTINGS.rowLimit &&
		settings.historyEnabled === DEFAULT_SETTINGS.historyEnabled &&
		settings.historyLimit === DEFAULT_SETTINGS.historyLimit
	);
}
