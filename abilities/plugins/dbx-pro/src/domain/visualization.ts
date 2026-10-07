/**
 * 可视化产物契约。
 *
 * 工具生成（dbx_chart_collection）和 UI 预览共用。
 * 旧 Canvas 规则引擎 / preset 模板 / inferLayout 已移除，
 * 所有产物统一走 Chart.js charts[] + 自动 Grid 布局。
 */

/** 单个 Chart.js 图表（与宿主 chart-renderer 的 ChartItem 格式兼容）。 */
export interface ChartItem {
	type: "line" | "bar" | "pie" | "doughnut" | "polarArea" | "radar" | "scatter" | "bubble";
	/** Chart.js data: { labels: string[], datasets: [...] } */
	data: Record<string, unknown>;
	/** Chart.js options（可选覆盖） */
	options?: Record<string, unknown>;
	title?: string;
	description?: string;
	height?: number;
}

export interface Visualization {
	id?: string;
	title: string;
	/** 页面主题：dashboard (浅) 或 screen (深 DataV) */
	type: "dashboard" | "screen";
	connection: string;
	table: string;
	/** 完整 HTML 页面（含 Chart.js CDN + Grid 布局 + 主题样式） */
	html: string;
	/** Chart.js 图表数组（宿主 chart-renderer 兼容格式，可二次编辑） */
	chartItems: ChartItem[];
	createdAt?: number;
}
