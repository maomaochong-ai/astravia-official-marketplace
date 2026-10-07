/**
 * dbx_chart_collection — 轻量看板/大屏生成工具。
 *
 * 只负责编排：接收 Chart.js charts[] → 拼装 HTML shell + Chart.js init → 返回 iframe srcDoc。
 * 模板/CSS 在 chart-shell.ts，Chart.js defaults 在 chart-defaults.ts，
 * 本文件不硬编码任何样式或 JS 配置。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";
import { getChartDefaultsScript } from "../features/visualization/chart-defaults";
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

/** 图表数据守卫 — Chart.js 默默接受错格式（rows 替代 datasets、空数组、datasets=0），
 *  不会 throw，只会创建一个 datasets=0 的空 Chart 实例 → canvas 白屏。
 *  本函数校验 chart.data，格式不对时注入可见错误提示 HTML 而不是静默空白。
 *
 *  常见 AI 错：
 *    chart.data = [100,200,300]                       → 数组不是对象
 *    chart.data = { rows: [{x,y}, ...] }              → rows 没转 datasets
 *    chart.data = { labels: [...], datasets: [] }     → 空 datasets
 *    chart.data = null / undefined                    → 缺失
 */
export function validateChartData(data: unknown): { ok: boolean; reason?: string } {
	if (data === null || data === undefined) return { ok: false, reason: "缺少 data" };
	if (Array.isArray(data)) return { ok: false, reason: "data 是数组，应该是 { datasets: [...] }" };
	if (typeof data !== "object") return { ok: false, reason: `data 类型异常: ${typeof data}` };
	const o = data as Record<string, unknown>;
	if (!Array.isArray(o.datasets) || o.datasets.length === 0) {
		if (Array.isArray((o as Record<string, unknown>).rows)) {
			return { ok: false, reason: "data.rows 存在但没转成 datasets[]" };
		}
		return { ok: false, reason: "data.datasets 缺失或为空" };
	}
	return { ok: true };
}

/** 拼装图表区域 HTML 片段 + Chart.js 初始化代码，一次遍历返回两个字符串。 */
function buildChartArea(charts: ChartItem[], isScreen: boolean): { html: string; js: string } {
	const htmlParts: string[] = [];
	const jsParts: string[] = [];
	charts.forEach((chart, i) => {
		const id = `chart-${i}`;
		const height = chart.height ?? (isScreen ? 280 : 250);
		const valid = validateChartData(chart.data);

		if (!valid.ok) {
			// 数据格式异常 → 渲染可见错误卡片，而不是静默空白 canvas
			htmlParts.push(
				`<div class="chart-card chart-error">` +
				`<h3>${chart.title ?? `图表 ${i + 1}`}</h3>` +
				`<div style="height:${height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#ef4444;background:#fef2f2;border:1px dashed #fecaca;border-radius:8px;margin:12px 0;padding:16px;box-sizing:border-box;">` +
				`<span style="font-weight:600;font-size:13px;">⚠️ 图表数据格式错误</span>` +
				`<span style="font-size:11px;color:#7f1d1d;">${valid.reason}</span>` +
				`<span style="font-size:10px;color:#b91c1c;">AI 未正确将查询结果转为 Chart.js { datasets: [...] } 格式</span>` +
				`</div></div>`
			);
			jsParts.push(`/* chart-${i} skipped: ${valid.reason} */`);
			return;
		}

		htmlParts.push(`<div class="chart-card"><h3>${chart.title ?? `图表 ${i + 1}`}</h3>${chart.description ? `<p class="chart-desc">${chart.description}</p>` : ""}<div style="height:${height}px"><canvas id="${id}"></canvas></div></div>`);
		jsParts.push(`new Chart(document.getElementById('${id}'),{type:'${chart.type}',data:${JSON.stringify(chart.data)},options:__dbxMergeOpts(${JSON.stringify(chart.options ?? {})})});`);
	});
	return { html: htmlParts.join(""), js: jsParts.join("\n") };
}

export function generateHtml(input: DbxChartCollectionInput): string {
	const charts = input.charts.slice(0, 12); // 这里负责上限——handler 不再 trim
	const isScreen = (input.type ?? "dashboard") === "screen";
	const title = input.title || "数据看板";
	const chartArea = buildChartArea(charts, isScreen);
	const head = buildHtmlHead({ title, chartJsCdn: CHARTJS_CDN, isScreen });

	// 模板字符串里只保留真正需要插值的部分，不再嵌套 blocks.map
	return `${head}
<div class="grid" style="${resolveGridCols(input.layout, charts.length)}">${chartArea.html}</div>
<script>
${getChartDefaultsScript(isScreen)}
${chartArea.js}
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
				layout: { type: "string", enum: ["auto", "grid-2", "grid-3", "grid-4"], description: "Grid columns. auto=responsive." },
			},
			required: ["charts", "title"],
			additionalProperties: true,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			if (!input.charts?.length) return { ok: false, error: "charts[] must be non-empty" };
			if (!input.title) return { ok: false, error: "title is required" };

			try {
				const html = generateHtml(input); // 内部已 slice(0, 12)，handler 不再 trim
				const trimmedCount = Math.min(input.charts.length, 12);
				const raw = input as unknown as Record<string, unknown>;
				const viz = {
					title: input.title,
					type: input.type ?? "dashboard",
					// connection_name / table / sql 是内部追踪字段，Agent schema 不暴露
					connection: (raw.connection_name as string) ?? "",
					table: (raw.table as string) ?? "",
					sql: (raw.sql as string) ?? undefined,
					html,
					chartItems: input.charts.slice(0, 12),
				};
				saveVisualizationToStore(viz);
				showVisualizationPreview(viz);
				return { ok: true, title: input.title, type: viz.type, chartCount: trimmedCount, message: `${viz.type === "screen" ? "大屏" : "看板"}「${input.title}」已生成（${trimmedCount} 个图表）。` };
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
