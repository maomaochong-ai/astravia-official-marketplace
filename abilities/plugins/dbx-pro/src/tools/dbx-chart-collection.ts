/**
 * dbx_chart_collection — 轻量看板/大屏生成工具。
 *
 * 只负责编排：接收 Chart.js charts[] → 拼装 HTML shell + Chart.js init → 返回 iframe srcDoc。
 * 模板/CSS 在 chart-shell.ts，Chart.js defaults 在 chart-defaults.ts，
 * 本文件不硬编码任何样式或 JS 配置。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";
import { buildChartDefaultsScript } from "../features/visualization/chart-defaults";
import { buildHtmlHead } from "../features/visualization/chart-shell";
import type { ChartItem } from "../domain/chart-contract";

export type ChartType = ChartItem["type"];

export interface DbxChartCollectionInput {
	charts: ChartItem[];
	type?: "dashboard" | "screen";
	title: string;
	connection_name?: string;
	table?: string;
	layout?: "auto" | "grid-2" | "grid-3" | "grid-4";
}

const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

/** 根据图表数量和 layout 返回 grid-template-columns 值。 */
function resolveGridCols(
	layout: DbxChartCollectionInput["layout"],
	chartCount: number,
): string {
	if (layout === "grid-2") return "grid-template-columns: repeat(2, 1fr);";
	if (layout === "grid-3") return "grid-template-columns: repeat(3, 1fr);";
	if (layout === "grid-4") return "grid-template-columns: repeat(4, 1fr);";
	if (chartCount <= 2) return "grid-template-columns: repeat(2, 1fr);";
	if (chartCount <= 4) return "grid-template-columns: repeat(2, 1fr);";
	if (chartCount <= 9) return "grid-template-columns: repeat(3, 1fr);";
	return "grid-template-columns: repeat(4, 1fr);";
}

/** 拼装单图表的 HTML 片段 + Chart.js 初始化一行。 */
function buildChartBlocks(charts: ChartItem[], isScreen: boolean) {
	return charts.map((chart, i) => {
		const id = `chart-${i}`;
		const height = chart.height ?? (isScreen ? 280 : 250);
		const html = `<div class="chart-card"><h3>${chart.title ?? `图表 ${i + 1}`}</h3>${chart.description ? `<p class="chart-desc">${chart.description}</p>` : ""}<div style="height:${height}px"><canvas id="${id}"></canvas></div></div>`;
		const js = `new Chart(document.getElementById('${id}'),{type:'${chart.type}',data:${JSON.stringify(chart.data)},options:__dbxMergeOpts(${JSON.stringify(chart.options ?? {})})});`;
		return { html, js };
	});
}

export function generateHtml(input: DbxChartCollectionInput): string {
	const charts = input.charts.slice(0, 12);
	const isScreen = (input.type ?? "dashboard") === "screen";
	const title = input.title || "数据看板";
	const gridCols = resolveGridCols(input.layout, charts.length);
	const blocks = buildChartBlocks(charts, isScreen);
	const chartDefaults = buildChartDefaultsScript(isScreen);
	const head = buildHtmlHead({ title, chartJsCdn: CHARTJS_CDN, isScreen });

	return `${head}
<div class="grid" style="${gridCols}">${blocks.map((b) => b.html).join("")}</div>
<script>
${chartDefaults}
${blocks.map((b) => b.js).join("\n")}
</script>
</body>
</html>`;
}

export function createDbxChartCollectionTool(): PluginAgentToolRegistration<DbxChartCollectionInput> {
	return {
		id: "dbx_chart_collection",
		name: "dbx_chart_collection",
		label: "看板/大屏",
		description: [
			"Generate a full-page dashboard or big-screen by combining multiple Chart.js charts.",
			"Input: charts[] array (Chart.js { type, data, options }).",
			"Output: HTML page with auto Grid layout + theme (dashboard=light, screen=dark).",
			"Chart.js defaults already set: no dark borders, soft grid lines, responsive cards.",
			"Use when you have multiple charts and want to package them into a shareable page.",
			"Max 12 charts. Compatible with render_chart tool's ChartItem format.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				charts: {
					type: "array",
					description: "Array of Chart.js chart items. Each item accepts any Chart.js field (data, options, plugins, etc.). Only type is required.",
					items: {
						type: "object",
						properties: {
							type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "polarArea", "radar", "scatter", "bubble"] },
						},
						required: ["type"],
						additionalProperties: true,
					},
					minItems: 1,
					maxItems: 12,
				},
				type: { type: "string", enum: ["dashboard", "screen"], description: "Page theme. dashboard=light QuickBI, screen=dark DataV." },
				title: { type: "string", description: "Page title." },
				connection_name: { type: "string", description: "Source connection name (for tracking)." },
				table: { type: "string", description: "Source table name (for tracking)." },
				layout: { type: "string", enum: ["auto", "grid-2", "grid-3", "grid-4"], description: "Grid columns. auto=responsive." },
			},
			required: ["charts", "title"],
			additionalProperties: true,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { charts, type = "dashboard", title, connection_name = "", table = "" } = input;
			if (!charts?.length) return { ok: false, error: "charts[] must be non-empty" };
			if (!title) return { ok: false, error: "title is required" };

			try {
				const trimmed = charts.slice(0, 12);
				const html = generateHtml(input);
				const viz = { title, type, connection: connection_name, table, html, chartItems: trimmed };
				saveVisualizationToStore(viz);
				showVisualizationPreview(viz);
				return { ok: true, title, type, chartCount: trimmed.length, message: `${type === "screen" ? "大屏" : "看板"}「${title}」已生成（${trimmed.length} 个图表）。` };
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
