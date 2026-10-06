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
	/** 默认每页显示行数（网格分页页大小；服务端分页时即 page.limit）。对齐 dbx pageSize。 */
	rowLimit: number;
	/** 是否记录查询历史。 */
	historyEnabled: boolean;
	/** 历史条数上限。 */
	historyLimit: number;
	/**
	 * 导出行数限制开关（对齐 dbx 桌面壳 exportRowLimitEnabled，默认关闭＝导出全部）。
	 * 关闭时「导出全部数据」按页循环拉取到末页，不人为截断；
	 * 开启后最多导出 exportRowLimit 行。
	 */
	exportLimitEnabled: boolean;
	/** 导出行数上限（仅 exportLimitEnabled 开启时生效）。 */
	exportRowLimit: number;
	/** 表打开（树节点预览）的默认页大小。对齐 dbx tableOpenPageSize。 */
	tableOpenPageSize: number;
	/** 导出全部数据时每批取行数。对齐 dbx exportBatchSize。 */
	exportBatchSize: number;
	/**
	 * 查询结果总量上限开关（默认关闭）。对齐 dbx queryResultMaxRowsEnabled。
	 * 只限制可翻看的最大行数，不影响「共 N 行」的总行数统计。
	 */
	queryResultMaxRowsEnabled: boolean;
	/** 查询结果总量上限。对齐 dbx queryResultMaxRows。 */
	queryResultMaxRows: number;
	/** 滚到底部自动加载下一页。对齐 dbx infiniteScroll。 */
	infiniteScroll: boolean;
	/** 斑马纹行。对齐 dbx dataGridStripedRows。 */
	dataGridStripedRows: boolean;
	/** 十字准线高亮。对齐 dbx dataGridCrosshairHighlight。 */
	dataGridCrosshairHighlight: boolean;
	/** 双击单元格查看详情按钮可见。对齐 dbx dataGridCellDetailButtonVisible。 */
	dataGridCellDetailButtonVisible: boolean;
	/** 多语句默认视图。对齐 dbx multiStatementDefaultView。 */
	multiStatementDefaultView: "result" | "messages";
	/** 执行计划默认视图。对齐 dbx defaultExplainView。 */
	defaultExplainView: "table" | "canvas";
	/** 结果标签命名方式。对齐 dbx resultTabNamingMode。 */
	resultTabNamingMode: "source" | "table" | "sequential";
	/** 结果标签显示来源数据库。对齐 dbx showResultSourceDatabase。 */
	showResultSourceDatabase: boolean;
}

/**
 * 引擎制品单次结果上限 MAX_EXECUTE_QUERY_ROWS = 1000。
 * 已用包内二进制实测：max_rows=200/500/1000 均按值返回。
 * 可分页的单条 SELECT 会被引擎包成派生表 + LIMIT/OFFSET（见 engine/sql-pagination.mjs），
 * 每次只取一页；其余 SQL 原样透传，结果在 ENGINE_ROW_CAP 处截断并标注。
 */
export const ENGINE_ROW_CAP = 1000;

/** 网格可选的每页行数（底部下拉）。对齐 dbx 桌面壳 4 档，另加 2000/5000 便于大页浏览。 */
export const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000, 2000, 5000] as const;

/**
 * 每页行数允许的最大值（自定义与设为默认共用）。
 *
 * 引擎单次结果硬上限是 ENGINE_ROW_CAP，超过它的页由执行层分块串行拼页
 * （N/cap 次 LIMIT/OFFSET），再一次性渲染整页。dbx 桌面壳结果表是虚拟滚动，
 * 上限取 1_000_000 无妨；本插件结果表是非虚拟化 DOM，一页 N 行就真的挂 N 行
 * 节点，故上限取 10 倍 cap（5000 档位之上留出余量），兼顾「自定义每页行数不被
 * 悄悄回退」与「整页渲染不至于卡死」。
 */
export const MAX_RESULT_PAGE_SIZE = 10 * ENGINE_ROW_CAP;
export const MIN_RESULT_PAGE_SIZE = 1;

/**
 * 「导出全部数据」行数上限的合法区间（仅在 exportLimitEnabled 开启时生效）。
 * 对齐 dbx 桌面壳 normalizeExportRowLimit：100..2_147_483_647，默认 100_000。
 */
export const EXPORT_ROW_LIMIT_MIN = 100;
export const EXPORT_ROW_LIMIT_MAX = 2_147_483_647;
export const EXPORT_ROW_LIMIT_DEFAULT = 100_000;

/**
 * 表打开（树节点预览）的默认页大小。
 * 对齐 dbx 桌面壳 DEFAULT_TABLE_OPEN_PAGE_LIMIT = DEFAULT_RESULT_PAGE_SIZE = 100
 * （apps/desktop/src/lib/table/tableOpenPageLimit.ts）。
 */
export const DEFAULT_TABLE_OPEN_PAGE_SIZE = 100;

/**
 * 导出全部数据时每批取行数。
 * 对齐 dbx 桌面壳 exportBatchSize = 2000，范围 [100, 100_000]
 * （apps/desktop/src/stores/settingsStore.ts:1388）。
 */
export const EXPORT_BATCH_SIZE_MIN = 100;
export const EXPORT_BATCH_SIZE_MAX = 100_000;
export const EXPORT_BATCH_SIZE_DEFAULT = 2_000;

/**
 * 查询结果总量上限。
 * 对齐 dbx 桌面壳 DEFAULT_QUERY_RESULT_MAX_ROWS = 100_000，
 * MAX_QUERY_RESULT_MAX_ROWS = 2_147_483_647
 * （apps/desktop/src/lib/dataGrid/queryResultRowLimit.ts）。
 */
export const QUERY_RESULT_MAX_ROWS_MIN = 1;
export const QUERY_RESULT_MAX_ROWS_MAX = 2_147_483_647;
export const QUERY_RESULT_MAX_ROWS_DEFAULT = 100_000;

/**
 * 页大小夹逼：设置项与网格下拉共用。
 * 对齐 dbx normalizeResultPageSize：合法整数夹到 [1, MAX_RESULT_PAGE_SIZE]，
 * 坏值回落到 fallback（默认 100）。
 */
export function resolvePageSize(value: unknown, fallback: number = DEFAULT_SETTINGS.rowLimit): number {
	const num = Number(value);
	if (!Number.isFinite(num) || num < MIN_RESULT_PAGE_SIZE) return fallback;
	return Math.min(Math.floor(num), MAX_RESULT_PAGE_SIZE);
}

/**
 * 「每页行数」输入的解析结果：除最终取值外，回报是否被上下限改写过。
 *
 * 设置面板与网格底栏下拉都要「不静默改数」——用户输入超过上限时，除了按上限取值，
 * 还要能说清为什么。夹逼规则仍走 resolvePageSize，避免出现第二份「上限是多少」的事实源。
 */
export interface PageSizeInputResult {
	/** 最终应写回设置或立即生效的取值。 */
	value: number;
	/** 输入大于每页上限：value 即上限值。 */
	exceededMax: boolean;
	/** 输入小于最小行数（含 0 与负数）：value 回落 fallback，即保留原值。 */
	belowMin: boolean;
}

/** 解析输入框里敲的每页行数：允许前后空白与小数，非法输入按 fallback（当前值）处理。 */
export function parsePageSizeInput(raw: string, fallback: number): PageSizeInputResult {
	const trimmed = raw.trim();
	const num = Number(trimmed);
	// resolvePageSize 把空值、坏值与越下限都归到 fallback，这里只额外判断命中了哪一侧边界。
	const numeric = trimmed !== "" && Number.isFinite(num);
	return {
		value: resolvePageSize(trimmed, fallback),
		exceededMax: numeric && Math.floor(num) > MAX_RESULT_PAGE_SIZE,
		belowMin: numeric && num < MIN_RESULT_PAGE_SIZE,
	};
}

/** 数值字段的边界（UI 的 min/max 必须取自这里，避免两处写死）。 */
export const SETTINGS_BOUNDS = Object.freeze({
	queryTimeoutSecs: { min: 1, max: 600 },
	/** rowLimit：默认每页显示行数，上限即 MAX_RESULT_PAGE_SIZE（超出引擎单次上限时分块拼页）。 */
	rowLimit: { min: MIN_RESULT_PAGE_SIZE, max: MAX_RESULT_PAGE_SIZE },
	historyLimit: { min: HISTORY_LIMIT_MIN, max: HISTORY_LIMIT_MAX },
	exportRowLimit: { min: EXPORT_ROW_LIMIT_MIN, max: EXPORT_ROW_LIMIT_MAX },
	tableOpenPageSize: { min: MIN_RESULT_PAGE_SIZE, max: MAX_RESULT_PAGE_SIZE },
	exportBatchSize: { min: EXPORT_BATCH_SIZE_MIN, max: EXPORT_BATCH_SIZE_MAX },
	queryResultMaxRows: { min: QUERY_RESULT_MAX_ROWS_MIN, max: QUERY_RESULT_MAX_ROWS_MAX },
});

export const DEFAULT_SETTINGS: WorkbenchSettings = Object.freeze({
	schemaVersion: 1,
	queryTimeoutSecs: 60,
	rowLimit: 100,
	historyEnabled: true,
	historyLimit: HISTORY_LIMIT_DEFAULT,
	exportLimitEnabled: false,
	exportRowLimit: EXPORT_ROW_LIMIT_DEFAULT,
	tableOpenPageSize: DEFAULT_TABLE_OPEN_PAGE_SIZE,
	exportBatchSize: EXPORT_BATCH_SIZE_DEFAULT,
	queryResultMaxRowsEnabled: false,
	queryResultMaxRows: QUERY_RESULT_MAX_ROWS_DEFAULT,
	infiniteScroll: false,
	dataGridStripedRows: true,
	dataGridCrosshairHighlight: false,
	dataGridCellDetailButtonVisible: true,
	multiStatementDefaultView: "result",
	defaultExplainView: "table",
	resultTabNamingMode: "source",
	showResultSourceDatabase: true,
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
		exportLimitEnabled:
			typeof source.exportLimitEnabled === "boolean"
				? source.exportLimitEnabled
				: DEFAULT_SETTINGS.exportLimitEnabled,
		exportRowLimit: clampInt(
			source.exportRowLimit,
			SETTINGS_BOUNDS.exportRowLimit.min,
			SETTINGS_BOUNDS.exportRowLimit.max,
			DEFAULT_SETTINGS.exportRowLimit,
		),
		tableOpenPageSize: clampInt(
			source.tableOpenPageSize,
			SETTINGS_BOUNDS.tableOpenPageSize.min,
			SETTINGS_BOUNDS.tableOpenPageSize.max,
			DEFAULT_SETTINGS.tableOpenPageSize,
		),
		exportBatchSize: clampInt(
			source.exportBatchSize,
			SETTINGS_BOUNDS.exportBatchSize.min,
			SETTINGS_BOUNDS.exportBatchSize.max,
			DEFAULT_SETTINGS.exportBatchSize,
		),
		queryResultMaxRowsEnabled:
			typeof source.queryResultMaxRowsEnabled === "boolean"
				? source.queryResultMaxRowsEnabled
				: DEFAULT_SETTINGS.queryResultMaxRowsEnabled,
		queryResultMaxRows: clampInt(
			source.queryResultMaxRows,
			SETTINGS_BOUNDS.queryResultMaxRows.min,
			SETTINGS_BOUNDS.queryResultMaxRows.max,
			DEFAULT_SETTINGS.queryResultMaxRows,
		),
		infiniteScroll:
			typeof source.infiniteScroll === "boolean"
				? source.infiniteScroll
				: DEFAULT_SETTINGS.infiniteScroll,
		dataGridStripedRows:
			typeof source.dataGridStripedRows === "boolean"
				? source.dataGridStripedRows
				: DEFAULT_SETTINGS.dataGridStripedRows,
		dataGridCrosshairHighlight:
			typeof source.dataGridCrosshairHighlight === "boolean"
				? source.dataGridCrosshairHighlight
				: DEFAULT_SETTINGS.dataGridCrosshairHighlight,
		dataGridCellDetailButtonVisible:
			typeof source.dataGridCellDetailButtonVisible === "boolean"
				? source.dataGridCellDetailButtonVisible
				: DEFAULT_SETTINGS.dataGridCellDetailButtonVisible,
		multiStatementDefaultView:
			source.multiStatementDefaultView === "result" || source.multiStatementDefaultView === "messages"
				? source.multiStatementDefaultView
				: DEFAULT_SETTINGS.multiStatementDefaultView,
		defaultExplainView:
			source.defaultExplainView === "table" || source.defaultExplainView === "canvas"
				? source.defaultExplainView
				: DEFAULT_SETTINGS.defaultExplainView,
		resultTabNamingMode:
			source.resultTabNamingMode === "source" || source.resultTabNamingMode === "table" || source.resultTabNamingMode === "sequential"
				? source.resultTabNamingMode
				: DEFAULT_SETTINGS.resultTabNamingMode,
		showResultSourceDatabase:
			typeof source.showResultSourceDatabase === "boolean"
				? source.showResultSourceDatabase
				: DEFAULT_SETTINGS.showResultSourceDatabase,
	};
}

/** 判断是否仍为出厂设置（设置页用来展示「恢复默认」是否有效）。 */
export function isDefaultSettings(settings: WorkbenchSettings): boolean {
	return (
		settings.queryTimeoutSecs === DEFAULT_SETTINGS.queryTimeoutSecs &&
		settings.rowLimit === DEFAULT_SETTINGS.rowLimit &&
		settings.historyEnabled === DEFAULT_SETTINGS.historyEnabled &&
		settings.historyLimit === DEFAULT_SETTINGS.historyLimit &&
		settings.exportLimitEnabled === DEFAULT_SETTINGS.exportLimitEnabled &&
		settings.exportRowLimit === DEFAULT_SETTINGS.exportRowLimit &&
		settings.tableOpenPageSize === DEFAULT_SETTINGS.tableOpenPageSize &&
		settings.exportBatchSize === DEFAULT_SETTINGS.exportBatchSize &&
		settings.queryResultMaxRowsEnabled === DEFAULT_SETTINGS.queryResultMaxRowsEnabled &&
		settings.queryResultMaxRows === DEFAULT_SETTINGS.queryResultMaxRows &&
		settings.infiniteScroll === DEFAULT_SETTINGS.infiniteScroll &&
		settings.dataGridStripedRows === DEFAULT_SETTINGS.dataGridStripedRows &&
		settings.dataGridCrosshairHighlight === DEFAULT_SETTINGS.dataGridCrosshairHighlight &&
		settings.dataGridCellDetailButtonVisible === DEFAULT_SETTINGS.dataGridCellDetailButtonVisible &&
		settings.multiStatementDefaultView === DEFAULT_SETTINGS.multiStatementDefaultView &&
		settings.defaultExplainView === DEFAULT_SETTINGS.defaultExplainView &&
		settings.resultTabNamingMode === DEFAULT_SETTINGS.resultTabNamingMode &&
		settings.showResultSourceDatabase === DEFAULT_SETTINGS.showResultSourceDatabase
	);
}
