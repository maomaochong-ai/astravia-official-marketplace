/**
 * figure-palette — figure 片段（funnel / boxplot / metric）的取色。
 *
 * 为什么颜色要在这里算成字面量、内联进片段，而不是走 CSS 变量：
 * 同一段片段既注入宿主 UI（dangerouslySetInnerHTML），也写进导出的独立 HTML。
 * 导出页没有任何宿主 CSS 变量，片段必须自包含。
 *
 * 色值与主题同源：
 *   - text / muted 与 visualization.css 的 --viz-title / --viz-desc 逐字一致；
 *   - grid / axis 与 themes/chart-defaults-*.js 里的 gridColor / tickColor 逐字一致；
 *   - series 复用 SERIES_COLORS（同一份色板同时供图表片段与导出 HTML 的默认 dataset 用）。
 */

/**
 * 类别色板 —— 与 dbx-chart-collection 给 AI 补的默认 dataset 配色同一份，
 * 这样 figure 与同一页里的 Chart.js 图表看起来是一套体系。
 *
 * 注意：前三位与总长度被 src/test/figure-render.test.js 钉住（该测试不在本目录内），
 * 换色板必须先同步那个断言。
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
	/** 卡片内主文字色：锁定 --viz-title / .chart-card h3 = #111827 */
	text: "#111827",
	/** 次要说明文字：锁定 --viz-desc / .chart-desc = #6b7280 */
	muted: "#6b7280",
	/** 轴线、须线等结构性线条 */
	axis: "#656d76",
	/** 网格线：必须与 themes/chart-defaults-dashboard.js 的 gridColor 一致 */
	grid: "#d0d7de",
	/** 片段内部嵌套容器（指标卡）的底色 */
	surface: "#f6f8fa",
	/** 嵌套容器描边 */
	surfaceBorder: "#d0d7de",
	/** 向好方向（指标卡环比上涨） */
	up: "#1a7f37",
	/** 转差方向（指标卡环比下跌） */
	down: "#cf222e",
	series: SERIES_COLORS,
};

/** 大屏深色主题 —— 与 themes/chart-defaults-screen.js、.viz-theme-screen 对齐。 */
const SCREEN_PALETTE: FigurePalette = {
	/** 卡片内主文字色：锁定 --viz-title = #a5f3fc */
	text: "#a5f3fc",
	/** 次要说明文字：锁定 --viz-desc = #94a3b8 */
	muted: "#94a3b8",
	axis: "#8b949e",
	/** 必须与 themes/chart-defaults-screen.js 的 gridColor 一致 */
	grid: "#30363d",
	surface: "#161b22",
	surfaceBorder: "#30363d",
	up: "#3fb950",
	down: "#f85149",
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
