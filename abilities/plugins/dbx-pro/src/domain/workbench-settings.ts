/**
 * 工作台设置 —— 纯逻辑层（不导入 SDK，可被 `node --test` 直接导入）。
 *
 * 存储副作用在 `workbench-settings-store.ts`。
 * 架构口径：读取走引擎服务；写 / DDL 走自研驱动，并在【每次执行前】弹窗确认，
 * 因此这里不再需要全局「写开关」或「CLI 回退路径」等历史概念。
 * 所有字段都做「宽容解析 + 夹逼」，坏值不会让面板崩：读不到就用默认值。
 */

import { clampInt, HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX, HISTORY_LIMIT_MIN } from "./query-history.ts";

export interface WorkbenchSettings {
	schemaVersion: 1;
	/** 查询超时（秒）。 */
	queryTimeoutSecs: number;
	/** 默认每页显示行数（网格分页页大小；服务端分页时即 page.limit）。 */
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
 * 引擎制品单次结果上限 MAX_EXECUTE_QUERY_ROWS = 1000。
 * 已用包内二进制实测：max_rows=200/500/1000 均按值返回。
 * 可分页的单条 SELECT 会被引擎包成派生表 + LIMIT/OFFSET（见 engine/sql-pagination.mjs），
 * 每次只取一页；其余 SQL 原样透传，结果在 ENGINE_ROW_CAP 处截断并标注。
 */
export const ENGINE_ROW_CAP = 1000;

/** 网格可选的每页行数（底部下拉）。 */
export const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000] as const;

/**
 * 每页行数允许的最大值（自定义与设为默认共用）。
 * dbx 桌面壳为 1_000_000（其网格虚拟滚动）；本插件结果表为非虚拟化 DOM，
 * 过大会让渲染卡顿，夹到 10_000；超过引擎单次硬上限的部分由执行层
 * 按 ENGINE_ROW_CAP 分块循环拉取拼页，对用户仍是「一页 N 行」。
 */
export const MAX_RESULT_PAGE_SIZE = 10_000;
export const MIN_RESULT_PAGE_SIZE = 1;

/**
 * 页大小夹逼：设置项与网格下拉共用。
 * 这里是页大小而不是「结果行数上限」——引擎单次上限 ENGINE_ROW_CAP 固定，
 * 大于它的页由执行层分块拉取拼接。
 */
export function resolvePageSize(value: unknown): number {
	const num = Number(value);
	if (!Number.isFinite(num) || num < MIN_RESULT_PAGE_SIZE) return DEFAULT_SETTINGS.rowLimit;
	return Math.min(Math.floor(num), MAX_RESULT_PAGE_SIZE);
}

/** 数值字段的边界（UI 的 min/max 必须取自这里，避免两处写死）。 */
export const SETTINGS_BOUNDS = Object.freeze({
	queryTimeoutSecs: { min: 1, max: 600 },
	/** rowLimit：默认每页显示行数（可超过引擎单次上限，执行层分块拼页）。 */
	rowLimit: { min: MIN_RESULT_PAGE_SIZE, max: MAX_RESULT_PAGE_SIZE },
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
