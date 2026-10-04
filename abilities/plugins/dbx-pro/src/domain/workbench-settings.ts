/**
 * 工作台设置 —— 纯逻辑层（不导入 SDK，可被 `node --test` 直接导入）。
 *
 * 存储副作用在 `workbench-settings-store.ts`。
 * 架构口径：读取走 dbx-mcp；写 / DDL 走自研驱动，并在【每次执行前】弹窗确认，
 * 因此这里不再需要全局「写开关」或「CLI 回退路径」等历史概念。
 * 所有字段都做「宽容解析 + 夹逼」，坏值不会让面板崩：读不到就用默认值。
 */

import { clampInt, HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX, HISTORY_LIMIT_MIN } from "./query-history.ts";

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
	/** 单击表节点的行为。 */
	tableSingleClickAction: "preview" | "structure";
	/** 双击表节点的行为。 */
	tableDoubleClickAction: "preview" | "structure";
}

/**
 * 宿主 dbx-mcp 制品（dbx 0.4.61）的真实读上限。
 *
 * 实测 max_rows=500 / 1000、甚至 SQL 自带 LIMIT 300，都只返回 100 行 ——
 * 源码里的 MAX_EXECUTE_QUERY_ROWS 没落到这个 release 制品上。设置项不允许
 * 超过它，否则 UI 会让人以为能取到 5000 行，实际只有 100 行。
 * 换用支持 max_rows 的新版二进制后把这个数调大即可。
 */
export const ENGINE_ROW_CAP = 1000;

/** 服务端 / 客户端网格每页行数（引擎每结果集硬上限即一页）。 */
export const RESULT_PAGE_SIZE = ENGINE_ROW_CAP;

/** 数值字段的边界（UI 的 min/max 必须取自这里，避免两处写死）。 */
export const SETTINGS_BOUNDS = Object.freeze({
	queryTimeoutSecs: { min: 1, max: 600 },
	rowLimit: { min: 1, max: ENGINE_ROW_CAP },
	historyLimit: { min: HISTORY_LIMIT_MIN, max: HISTORY_LIMIT_MAX },
});

export const DEFAULT_SETTINGS: WorkbenchSettings = Object.freeze({
	schemaVersion: 1,
	queryTimeoutSecs: 60,
	rowLimit: ENGINE_ROW_CAP,
	historyEnabled: true,
	historyLimit: HISTORY_LIMIT_DEFAULT,
	tableSingleClickAction: "structure",
	tableDoubleClickAction: "preview",
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
		tableSingleClickAction:
			source.tableSingleClickAction === "preview" || source.tableSingleClickAction === "structure"
				? source.tableSingleClickAction
				: DEFAULT_SETTINGS.tableSingleClickAction,
		tableDoubleClickAction:
			source.tableDoubleClickAction === "preview" || source.tableDoubleClickAction === "structure"
				? source.tableDoubleClickAction
				: DEFAULT_SETTINGS.tableDoubleClickAction,
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
		settings.historyLimit === DEFAULT_SETTINGS.historyLimit &&
		settings.tableSingleClickAction === DEFAULT_SETTINGS.tableSingleClickAction &&
		settings.tableDoubleClickAction === DEFAULT_SETTINGS.tableDoubleClickAction
	);
}
