/**
 * G2 工作台设置 —— 纯逻辑层（不导入 SDK，可被 `node --test` 直接导入）。
 *
 * 存储副作用在 `workbench-settings-store.ts`。
 * 所有字段都做「宽容解析 + 夹逼」，坏值不会让面板崩：读不到就用默认值。
 */

import { clampInt, HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX, HISTORY_LIMIT_MIN } from "./query-history";

/** 执行路径偏好：自动（引擎优先，失败回退本地 CLI）/ 仅引擎 / 仅本地 CLI。 */
export type EnginePreference = "auto" | "engine" | "cli";

export interface WorkbenchSettings {
	schemaVersion: 1;
	enginePreference: EnginePreference;
	/** 查询超时（秒），引擎与 CLI 两条路径共用 */
	queryTimeoutSecs: number;
	/** 结果行数上限（仅引擎路径生效，不会改写 SQL） */
	rowLimit: number;
	/** 是否允许写语句（引擎与 CLI 两条路径共用同一道闸门） */
	allowWrites: boolean;
	/** 是否记录查询历史 */
	historyEnabled: boolean;
	/** 历史条数上限 */
	historyLimit: number;
}

export const ENGINE_PREFERENCES: readonly EnginePreference[] = Object.freeze(["auto", "engine", "cli"]);

/** 数值字段的边界（UI 的 min/max 必须取自这里，避免两处写死）。 */
export const SETTINGS_BOUNDS = Object.freeze({
	queryTimeoutSecs: { min: 1, max: 300 },
	rowLimit: { min: 1, max: 100_000 },
	historyLimit: { min: HISTORY_LIMIT_MIN, max: HISTORY_LIMIT_MAX },
});

export const DEFAULT_SETTINGS: WorkbenchSettings = Object.freeze({
	schemaVersion: 1,
	enginePreference: "auto",
	queryTimeoutSecs: 30,
	rowLimit: 1000,
	allowWrites: false,
	historyEnabled: true,
	historyLimit: HISTORY_LIMIT_DEFAULT,
});

/** 偏好说明文案（设置页 + 状态条共用）。 */
export const PREFERENCE_HINTS: Record<EnginePreference, string> = {
	auto: "优先走自持引擎；引擎不可用时自动回退本地 sqlite3 CLI，并在状态条如实标注实际路径。",
	engine: "只走自持引擎。引擎不可用时直接报错，不回退（适合需要确认引擎行为时）。",
	cli: "只走本地 sqlite3 CLI，完全绕过引擎（适合排查引擎问题时做对照）。",
};

export function isEnginePreference(value: unknown): value is EnginePreference {
	return typeof value === "string" && (ENGINE_PREFERENCES as readonly string[]).includes(value);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	if (typeof value === "boolean") return value;
	return fallback;
}

/** 宽容解析设置：非对象 / 坏字段一律回落到默认值，数值夹逼到合法区间。 */
export function normalizeSettings(raw: unknown): WorkbenchSettings {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
	const source = raw as Record<string, unknown>;
	return {
		schemaVersion: 1,
		enginePreference: isEnginePreference(source.enginePreference) ? source.enginePreference : DEFAULT_SETTINGS.enginePreference,
		queryTimeoutSecs: clampInt(
			source.queryTimeoutSecs,
			SETTINGS_BOUNDS.queryTimeoutSecs.min,
			SETTINGS_BOUNDS.queryTimeoutSecs.max,
			DEFAULT_SETTINGS.queryTimeoutSecs,
		),
		rowLimit: clampInt(source.rowLimit, SETTINGS_BOUNDS.rowLimit.min, SETTINGS_BOUNDS.rowLimit.max, DEFAULT_SETTINGS.rowLimit),
		allowWrites: normalizeBoolean(source.allowWrites, DEFAULT_SETTINGS.allowWrites),
		historyEnabled: normalizeBoolean(source.historyEnabled, DEFAULT_SETTINGS.historyEnabled),
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
		settings.enginePreference === DEFAULT_SETTINGS.enginePreference &&
		settings.queryTimeoutSecs === DEFAULT_SETTINGS.queryTimeoutSecs &&
		settings.rowLimit === DEFAULT_SETTINGS.rowLimit &&
		settings.allowWrites === DEFAULT_SETTINGS.allowWrites &&
		settings.historyEnabled === DEFAULT_SETTINGS.historyEnabled &&
		settings.historyLimit === DEFAULT_SETTINGS.historyLimit
	);
}

export function preferenceLabel(preference: EnginePreference): string {
	if (preference === "engine") return "仅引擎";
	if (preference === "cli") return "仅本地 CLI";
	return "自动（引擎优先，失败回退）";
}
