/**
 * figure-palette — figure 片段（funnel / boxplot / metric）的取色。
 *
 * 为什么颜色要在这里算成字面量、内联进片段，而不是走 CSS 变量：
 * 同一段片段既注入宿主 UI（dangerouslySetInnerHTML），也写进导出的独立 HTML。
 * 导出页没有任何宿主 CSS 变量，片段必须自包含。
 *
 * 色值与主题同源，由 chart-theme-parity.test.js 钉住：
 *   - text / muted 与 visualization.css 的 --viz-title / --viz-desc，
 *     以及 themes/*.css 的 .chart-card h3 / .chart-desc 一致；
 *   - grid / axis 与 themes/chart-defaults-*.js 里的网格线、刻度色一致。
 */

/**
 * 类别色板 —— 与 dbx-chart-collection 给 AI 补的默认 dataset 配色同一份，
 * 这样 figure 与同一页里的 Chart.js 图表看起来是一套体系。
 */
export const SERIES_COLORS = [
	"#6366f1",
	"#06b6d4",
	"#f59e0b",
	"#10b981",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
] as const;

export interface FigurePalette {
	/** 卡片内主文字色（= --viz-title / .chart-card h3） */
	text: string;
	/** 次要说明文字（= --viz-desc / .chart-desc / 刻度字） */
	muted: string;
	/** 轴线、须线等结构性线条 */
	axis: string;
	/** 网格线（与 themes/chart-defaults-*.js 的 grid.color 一致） */
	grid: string;
	/** 片段内部嵌套容器（指标卡）的底色 */
	surface: string;
	/** 嵌套容器描边 */
	surfaceBorder: string;
	/** 向好方向（指标卡环比上涨） */
	up: string;
	/** 转差方向（指标卡环比下跌） */
	down: string;
	series: readonly string[];
}

/** 看板浅色主题 —— 与 themes/chart-defaults-dashboard.js、.viz-theme-dashboard 对齐。 */
const DASHBOARD_PALETTE: FigurePalette = {
	text: "#111827",
	muted: "#6b7280",
	axis: "#9ca3af",
	grid: "rgba(156,163,175,0.25)",
	surface: "#f9fafb",
	surfaceBorder: "#e5e7eb",
	up: "#16a34a",
	down: "#dc2626",
	series: SERIES_COLORS,
};

/** 大屏深色主题 —— 与 themes/chart-defaults-screen.js、.viz-theme-screen 对齐。 */
const SCREEN_PALETTE: FigurePalette = {
	text: "#a5f3fc",
	muted: "#94a3b8",
	axis: "#64748b",
	grid: "rgba(148,163,184,0.15)",
	surface: "rgba(255,255,255,0.03)",
	surfaceBorder: "rgba(6,182,212,0.25)",
	up: "#22c55e",
	down: "#f87171",
	series: SERIES_COLORS,
};

export function getFigurePalette(isScreen: boolean): FigurePalette {
	return isScreen ? SCREEN_PALETTE : DASHBOARD_PALETTE;
}

/** 按序号取类别色，超出色板长度后循环取模。 */
export function seriesColor(palette: FigurePalette, index: number): string {
	const list = palette.series;
	if (list.length === 0) return palette.text;
	const i = ((index % list.length) + list.length) % list.length;
	return list[i];
}

/** 给颜色加透明度（箱体填充用）。只处理 #rgb / #rrggbb / rgb() / rgba()，其余原样返回。 */
export function withAlpha(color: string, alpha: number): string {
	const value = color.trim();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
	if (hex) {
		const body = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
		const r = parseInt(body.slice(0, 2), 16);
		const g = parseInt(body.slice(2, 4), 16);
		const b = parseInt(body.slice(4, 6), 16);
		return `rgba(${r},${g},${b},${alpha})`;
	}
	const fn = /^rgba?\(([^)]+)\)$/i.exec(value);
	if (fn) {
		const parts = fn[1].split(",").map((s) => s.trim());
		if (parts.length >= 3) return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
	}
	return value;
}
