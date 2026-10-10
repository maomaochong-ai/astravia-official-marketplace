/**
 * 可视化产物契约。
 *
 * 工具生成（dbx_chart_collection）和 UI 预览共用。
 * 旧 Canvas 规则引擎 / preset 模板 / inferLayout 已移除，
 * 所有产物统一走 ChartItem[] + 自动 Grid 布局：
 * 8 种 Chart.js 原生类型画在 canvas 上，funnel / boxplot / metric 用自有渲染器
 * 生成 HTML 片段（UI 与导出共用同一份，见 features/visualization/figures）。
 *
 * M1 起产物有**数据来源**：`datasets[]`（SQL 即数据集）是可编辑的事实源，
 * `html` 退化为导出时的派生产物（ADR-0009 §4.1、§5.2）。
 */

/** 单个图表的类型。 */
export type ChartItemType =
	// 8 种 Chart.js 原生类型
	| "line"
	| "bar"
	| "pie"
	| "doughnut"
	| "polarArea"
	| "radar"
	| "scatter"
	| "bubble"
	// M2 起的自有渲染类型（不经过 Chart.js，见 features/visualization/figures）
	| "funnel"
	| "boxplot"
	| "metric";

/**
 * 单个图表（与宿主 chart-renderer 的 ChartItem 格式兼容）。
 *
 * `type` **只增不改**（ADR-0009 §10）：新增类型不影响既有取值的语义。
 * `line/bar/pie/doughnut/polarArea/radar/scatter/bubble` 走 Chart.js；
 * `funnel/boxplot/metric` 走自有渲染器，UI 与导出共用同一段 HTML 片段。
 */
export interface ChartItem {
	type: ChartItemType;
	/** Chart.js data: { labels: string[], datasets: [...] } */
	data: Record<string, unknown>;
	/** Chart.js options（可选覆盖） */
	options?: Record<string, unknown>;
	title?: string;
	description?: string;
	height?: number;
	/**
	 * 可选：声明这张图的数据由哪个数据集的哪几列映射而来。
	 *
	 * 有 source 的图在筛选变化时从 DatasetSpec.rows 重算 data（见 chart-source.ts），
	 * 没有 source 的图是静态快照 —— 旧产物、以及 scatter/bubble 这类由 AI 直接
	 * 组好坐标的图，都走「AI 给什么画什么」的原行为。
	 */
	source?: ChartSource;
}

/**
 * 图表 ← 数据集的映射声明。
 *
 * 只描述「哪一列当 labels、哪几列当 series」，不做聚合、不做计算字段 ——
 * 聚合口径由 DatasetSpec.sql 决定（ADR-0009 §6 第 3 条：计算字段请在 SQL 里写）。
 */
export interface ChartSource {
	/** 对应的 DatasetSpec.id */
	datasetId: string;
	/** 成为 Chart.js labels 的列 */
	labelColumn: string;
	/** 每个列一条 series（pie / doughnut / polarArea 只取第一个） */
	valueColumns: string[];
}

/** 一个数据集 = 一条 SQL + 它的结果。 */
export interface DatasetSpec {
	id: string;
	title: string;
	connection: string;
	table: string;
	sql: string;
	columns: string[];
	/** 落盘前按 DATASET_ROW_LIMIT 裁剪；SQL 完整行数见 rowCount */
	rows: Record<string, unknown>[];
	/** SQL 完整结果行数（可能大于 rows.length） */
	rowCount: number;
	fetchedAt: number;
}

/**
 * 产物级筛选条件。
 *
 * 默认在**前端**过滤 `DatasetSpec.rows`，不重跑 SQL，聚合口径不变（ADR-0009 §6 第 2 条）。
 * 字段不在 `columns` 里时被跳过而不是报错 —— 与 Quick BI 的跨数据集筛选一致。
 */
export interface ChartFilter {
	/** 多数据集产物里指定作用对象；缺省表示作用于所有数据集 */
	datasetId?: string;
	/** 字段名，必须来自 DatasetSpec.columns */
	column: string;
	/** 等值集合；空集合等价于不过滤 */
	values?: (string | number | boolean)[];
	/** 数值 / 日期范围（闭区间，min === max 即等值） */
	min?: number | string;
	max?: number | string;
}

export interface Visualization {
	id?: string;
	title: string;
	/** 页面主题：dashboard (浅) 或 screen (深 DataV) */
	type: "dashboard" | "screen";
	connection: string;
	table: string;
	/**
	 * 完整 HTML 页面（含 Chart.js 运行时 + Grid 布局 + 主题样式）。
	 *
	 * M1 起**只在导出时生成**：带 datasets 的产物不再落库 html，避免 html 与
	 * chartItems 成为两份互相漂移的事实源。旧产物仍有 html，只读快照依赖它。
	 */
	html?: string;
	/** Chart.js 图表数组（宿主 chart-renderer 兼容格式，可二次编辑） */
	chartItems: ChartItem[];
	/** 数据来源。缺失表示只读快照：只有 html，不能筛选 / 重新取数 */
	datasets?: DatasetSpec[];
	/** 产物级筛选 */
	filters?: ChartFilter[];
	/** 产生此看板的源 SQL（可选，AI 修改时需要知道数据源） */
	sql?: string;
	createdAt?: number;
}
