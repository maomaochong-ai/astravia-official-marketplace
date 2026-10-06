/**
 * Canvas LayoutSpec 契约（ADR-0005 §3.3）
 *
 * 这个 JSON 完全不含视觉属性（颜色、字号、圆角）——算法只产出空间布局 + 数据引用，
 * 渲染器根据 intent=themeMode 应用 token。
 */

export type VizIntent = "dashboard" | "bigscreen";
export type ChartKind = "kpi" | "line" | "bar" | "pie" | "area" | "table";

export interface WidgetSpec {
	id: string;
	kind: ChartKind;
	/** 0-based, 12 列栅格中的起始列 */
	col: number;
	/** 0-based, 起始行 */
	row: number;
	/** 1-12 */
	colSpan: number;
	/** 行数（dashboard 通常 1-3，bigscreen 可到 6+） */
	rowSpan: number;
	title: string;
	/** 数据引用：列名或聚合表达式 */
	dataRef: string;
	/** 可选图表专属配置：{ xAxis, yAxis, color, ... } */
	options?: Record<string, unknown>;
	/** 渲染状态：skeleton=骨架中 | ready=数据已到 */
	status?: "skeleton" | "ready";
	/** v0.0.94: 该 widget 属于哪个 dataSource（Canvas 多数据源路径） */
	dataSourceId?: string;
}

export interface LayoutSpec {
	intent: VizIntent;
	layout: { cols: 12; rowHeight: number; gap: number };
	widgets: WidgetSpec[];
}

/** 列语义标签（inferSchemaStep 打出来的 tag） */
export type ColumnRole = "dimension" | "measure" | "time" | "categorical" | "id";

export interface ColumnMeta {
	name: string;
	type: string;
	role: ColumnRole;
	cardinality?: number;
}
