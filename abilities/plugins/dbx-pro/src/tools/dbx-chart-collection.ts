/**
 * dbx_chart_collection — 轻量看板/大屏生成工具。
 *
 * 只负责编排：接收 Chart.js charts[] → 拼装 HTML shell + Chart.js init → 返回 iframe srcDoc。
 * 模板/CSS 在 chart-shell.ts，Chart.js defaults 在 chart-defaults.ts，
 * 本文件不硬编码任何样式或 JS 配置。
 *
 * M1 起接收可选的 `datasets[]`：传了数据集就**不再落库 html**（html 退化为导出产物），
 * 产物改由 datasets + chartItems 驱动，可在「BI 数据资产」里筛选与重新取数。
 * 模板/CSS 在 chart-shell.ts，Chart.js defaults 在 chart-defaults.ts，
 * 本文件不硬编码任何样式或 JS 配置。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";
import { getChartDefaultsScript } from "../features/visualization/chart-defaults";
import { buildHtmlHead } from "../features/visualization/chart-shell";
import type { ChartItem, ChartFilter } from "../domain/chart-contract";
import { pruneUnboundSources } from "../domain/chart-source";
import { prepareDatasets, type DatasetSpecInput } from "../domain/dataset-spec";
import { SERIES_COLORS } from "../features/visualization/figures/figure-palette";
import { isFigureType, renderFigure } from "../features/visualization/figures/figure-registry";

export type ChartType = ChartItem["type"];

export interface DbxChartCollectionInput {
	charts: ChartItem[];
	type?: "dashboard" | "screen";
	title: string;
	connection_name?: string;
	table?: string;
	layout?: "auto" | "grid-2" | "grid-3" | "grid-4";
	/** 可选：数据来源。给了就由筛选 / 重新取数驱动，html 只在导出时生成 */
	datasets?: DatasetSpecInput[];
	/** 可选：随产物一起保存的初始筛选 */
	filters?: ChartFilter[];
}

const CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

/** 图表数量 / layout → 列数。UI 内渲染与导出共用同一份，避免两处网格对不上。 */
export function resolveGridColumnCount(
	layout: DbxChartCollectionInput["layout"],
	chartCount: number,
): number {
	if (layout === "grid-2") return 2;
	if (layout === "grid-3") return 3;
	if (layout === "grid-4") return 4;
	if (chartCount <= 4) return 2;
	if (chartCount <= 9) return 3;
	return 4;
}

/** 根据图表数量和 layout 返回 grid-template-columns 值。 */
function resolveGridCols(layout: DbxChartCollectionInput["layout"], chartCount: number): string {
	return `grid-template-columns: repeat(${resolveGridColumnCount(layout, chartCount)}, 1fr);`;
}

/** AI 常见错格式 → Chart.js 标准格式自动修正。
 *
 *  AI 最常犯：
 *    - 把 dbx_query_full 返回的 rows 直接塞 data（{ rows: [...] }）
 *    - data 是裸数组 [100, 200, 300]
 *    - datasets 有值但 labels 缺失
 *  normalize 尽力修正，修不回来才让 validateChartData 拒绝。
 */
export function normalizeChartData(
	data: unknown,
	_chartType: string = "bar",
): unknown {
	if (data === null || data === undefined) return data;

	// 1. 裸数组 → { labels: [0,1,2,...], datasets: [{ data: array }] }
	if (Array.isArray(data)) {
		if (data.length === 0) return data;
		const allPrimitives = data.every((v) => v == null || ["number", "string", "boolean"].includes(typeof v));
		if (allPrimitives) {
			const labels = data.map((_, i) => String(i + 1));
			return { labels, datasets: [{ data }] };
		}
		// 对象数组（scatter/bubble 的 { x, y }）—— 原样交给 Chart.js
		return data;
	}

	if (typeof data !== "object") return data;
	const o = data as Record<string, unknown>;

	// 2. data.rows 存在但没 datasets → 从 rows 第一行列名推 labels + 数值列变 datasets
	const rows = o.rows as unknown[];
	if (Array.isArray(rows) && rows.length > 0 && !Array.isArray(o.datasets)) {
		const firstRow = rows[0] as Record<string, unknown>;
		if (firstRow && typeof firstRow === "object") {
			const colNames = Object.keys(firstRow);
			if (colNames.length >= 2) {
				const labelCol = colNames[0];
				const labels = rows.map((r) => String((r as Record<string, unknown>)[labelCol] ?? ""));
				const valueCols = colNames.slice(1);
				const colors = SERIES_COLORS;
				const datasets = valueCols.map((colName, idx) => ({
					label: colName,
					data: rows.map((r: unknown) => {
						const v = (r as Record<string, unknown>)[colName];
						const n = Number(v);
						return Number.isFinite(n) ? n : v;
					}),
					backgroundColor: colors[idx % colors.length],
					borderColor: colors[idx % colors.length],
					borderWidth: 1,
				}));
				return { labels, datasets };
			}
		}
		return data;
	}

	// 3. datasets 有值但 labels 缺失 → 生成索引标签
	if (Array.isArray(o.datasets) && o.datasets.length > 0 && !Array.isArray(o.labels)) {
		const firstDs = o.datasets[0] as { data?: unknown[] };
		const len = Array.isArray(firstDs?.data) ? firstDs.data.length : 0;
		if (len > 0) {
			return { ...o, labels: Array.from({ length: len }, (_, i) => String(i + 1)) };
		}
	}

	return data;
}

/** 图表数据守卫 — Chart.js 默默接受错格式（rows 替代 datasets、空数组、datasets=0），
 *  不会 throw，只会创建一个 datasets=0 的空 Chart 实例 → canvas 白屏。
 *  normalizeChartData 修不回来的，这里拒绝并返回原因。
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

		// 先 normalize：AI 传的错格式自动修正（rows→datasets、裸数组→包装、缺 labels→补索引）
		const normalizedData = normalizeChartData(chart.data, chart.type);
		const valid = validateChartData(normalizedData);

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

		// 自有渲染类型（funnel / boxplot / metric）：片段自包含，与 UI 抽屉用的是同一段字符
		// （ADR-0009 §10 ⑤），所以这里不生成 `new Chart(...)`，也不往页面上放 canvas。
		if (isFigureType(chart.type)) {
			htmlParts.push(
				`<div class="chart-card"><h3>${chart.title ?? `图表 ${i + 1}`}</h3>${chart.description ? `<p class="chart-desc">${chart.description}</p>` : ""}${renderFigure({ ...chart, data: normalizedData as Record<string, unknown> }, { isScreen })}</div>`,
			);
			jsParts.push(`/* chart-${i} (${chart.type}) rendered without Chart.js */`);
			return;
		}

		htmlParts.push(`<div class="chart-card"><h3>${chart.title ?? `图表 ${i + 1}`}</h3>${chart.description ? `<p class="chart-desc">${chart.description}</p>` : ""}<div style="height:${height}px"><canvas id="${id}"></canvas></div></div>`);
		jsParts.push(`new Chart(document.getElementById('${id}'),{type:'${chart.type}',data:${JSON.stringify(normalizedData)},options:__dbxMergeOpts(${JSON.stringify(chart.options ?? {})})});`);
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
			"Optional datasets[]: pass one entry per SQL query you used, then set charts[].source to bind a chart to a dataset.",
			"With datasets, the artifact is stored as data (no html) so the user can filter and refetch without re-running the conversation.",
			"datasets[].rows only needs the rows you actually received; put the SQL's full row count in rowCount.",
			"Figure types render without Chart.js: funnel = { labels, datasets: [{ label, data }] } (single series; bar width shows decay, order is the stage order); metric = one card per label, datasets[0].data is the big number and datasets[1..] are secondary rows whose first entry drives the delta; boxplot = datasets: [{ data: [[min,q1,median,q3,max], ...] }] five-number summaries.",
			"Figure presentation options go in options.figure: { unit, digits, showDelta, showPercent, min, max }.",
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
							type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "polarArea", "radar", "scatter", "bubble", "funnel", "boxplot", "metric"] },
							source: {
								type: "object",
								description: "Bind this chart to a dataset so it re-reads rows when the user changes filters. Omit for a static chart.",
								properties: {
									datasetId: { type: "string", description: "Must equal datasets[].id." },
									labelColumn: { type: "string", description: "Column used as Chart.js labels / categories." },
									valueColumns: { type: "array", items: { type: "string" }, description: "Columns used as chart datasets (series). pie/doughnut/polarArea use only the first." },
								},
								required: ["datasetId", "labelColumn", "valueColumns"],
								additionalProperties: true,
							},
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
				datasets: {
					type: "array",
					description: "Optional data sources. Each entry is one aggregate query. When present, html is not stored; the page is generated at export time.",
					items: {
						type: "object",
						properties: {
							id: { type: "string", description: "Stable id; charts[].source.datasetId must match it." },
							title: { type: "string", description: "Human-readable name, e.g. the metric being shown." },
							connection: { type: "string" },
							table: { type: "string" },
							sql: { type: "string", description: "The aggregate SQL that produced these rows; refetch re-runs it as-is." },
							columns: { type: "array", items: { type: "string" } },
							rows: { type: "array", items: { type: "object", additionalProperties: true } },
							rowCount: { type: "number", description: "Full row count of the SQL result, even when rows is only a sample." },
						},
						required: ["id", "sql"],
						additionalProperties: true,
					},
				},
				filters: {
					type: "array",
					description: "Optional initial filters to store with the artifact. The user can change them later in the UI.",
					items: {
						type: "object",
						properties: {
							column: { type: "string", description: "Must be one of datasets[].columns." },
							datasetId: { type: "string", description: "Omit to apply to every dataset." },
							values: { type: "array", items: { type: "string" }, description: "Equality set; numbers may be given as strings." },
							min: { description: "Inclusive lower bound (number or ISO date string)." },
							max: { description: "Inclusive upper bound (number or ISO date string)." },
						},
						required: ["column"],
						additionalProperties: true,
					},
				},
			},
			required: ["charts", "title"],
			additionalProperties: true,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			if (!input.charts?.length) return { ok: false, error: "charts[] must be non-empty" };
			if (!input.title) return { ok: false, error: "title is required" };

			try {
				const raw = input as unknown as Record<string, unknown>;
				const chartItems = input.charts.slice(0, 12);
				const prepared = prepareDatasets(input.datasets ?? [], chartItems);
				const bound = pruneUnboundSources(chartItems, prepared.datasets);
				const hasDatasets = prepared.datasets.length > 0;

				const viz = {
					title: input.title,
					type: input.type ?? "dashboard",
					// connection_name / table / sql 是内部追踪字段，Agent schema 不暴露
					connection: (raw.connection_name as string) ?? "",
					table: (raw.table as string) ?? "",
					sql: (raw.sql as string) ?? undefined,
					chartItems: bound.items,
					// 有数据集时 html 不落库：它是导出时的派生产物，存下来只会与数据集不一致
					...(hasDatasets
						? { datasets: prepared.datasets, filters: input.filters ?? [] }
						: { html: generateHtml(input) }),
				};
				saveVisualizationToStore(viz);
				showVisualizationPreview(viz);

				const kind = viz.type === "screen" ? "大屏" : "看板";
				const notes: string[] = [];
				if (bound.unboundCount > 0) {
					notes.push(`${bound.unboundCount} 张图引用的数据集不在 datasets[] 里，已按静态图处理`);
				}
				for (const item of prepared.degraded) {
					notes.push(
						item.reason === "sql-only"
							? `数据集「${item.title}」太大，只保留了 SQL，需要在详情里重新取数`
							: `数据集「${item.title}」已裁剪未被图表引用的列`,
					);
				}
				const tail = hasDatasets ? "，可在「BI 数据资产」里筛选与重新取数" : "";
				const warn = notes.length > 0 ? ` 注意：${notes.join("；")}。` : "";
				return {
					ok: true,
					title: input.title,
					type: viz.type,
					chartCount: bound.items.length,
					datasetCount: prepared.datasets.length,
					message: `${kind}「${input.title}」已生成（${bound.items.length} 个图表${tail}）。${warn}`,
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}
