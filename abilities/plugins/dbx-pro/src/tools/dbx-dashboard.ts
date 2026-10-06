/**
 * dbx_dashboard — 企业级看板生成工具（ADR-0007 统一流水线）。
 *
 * 执行预设模板 SQL → 合并结果集 → 走 Canvas 规则引擎自动推断布局。
 * 不再直接组装 charts[] 数组交给 preset renderer；Canvas 是唯一渲染路径。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, engineDescribeByName } from "../shared/services/engine-client";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";
import { DASHBOARD_PRESETS } from "../features/visualization/presets/dashboard/presets";
import type { DashboardPreset, ChartConfig } from "../features/visualization/presets/dashboard/presets";

export type DashboardTemplate = "kpi_overview" | "trend_analysis" | "data_profile";

export interface DbxDashboardInput {
	connection_name: string;
	tables: string[];
	template: DashboardTemplate;
	schema?: string;
	db_type?: string;
	date_column?: string;
}

interface ChartResult {
	id: string;
	type: string;
	title: string;
	columns: string[];
	rows: Array<Record<string, unknown>>;
	config?: ChartConfig["config"];
	layout: ChartConfig["layout"];
}

export function createDbxDashboardTool(): PluginAgentToolRegistration<DbxDashboardInput> {
	return {
		id: "dbx_dashboard",
		name: "dbx_dashboard",
		label: "企业看板",
		description: [
			"Generate enterprise dashboard from database tables using preset templates.",
			"Templates: kpi_overview (KPI cards + trends), trend_analysis (time series), data_profile (statistics).",
			"Returns structured data for component rendering with recharts.",
			"Use when user wants to create a dashboard, visualize data, or analyze metrics from tables.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: { type: "string", description: "Database connection name." },
				tables: { type: "array", items: { type: "string" }, description: "Table names." },
				template: { type: "string", enum: ["kpi_overview", "trend_analysis", "data_profile"], description: "Dashboard template." },
				schema: { type: "string", description: "Schema name (optional)." },
				db_type: { type: "string", description: "Database type (e.g., postgres, mysql)." },
				date_column: { type: "string", description: "Date column name. Auto-detected if omitted." },
			},
			required: ["connection_name", "tables", "template"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, tables, template, schema, db_type, date_column } = input;

			if (!connection_name) return { ok: false, error: "connection_name is required" };
			if (!tables?.length) return { ok: false, error: "tables must be non-empty" };

			const table = tables[0];
			const preset = DASHBOARD_PRESETS.find((p) => p.id === template);
			if (!preset) return { ok: false, error: `Unknown template: ${template}` };

			try {
				// 自动检测日期列
				const desc = await engineDescribeByName(connection_name, { table, schema });
				const columns = desc.columns.map((c) => c.name);
				const hasDateCol = columns.some((c) => /date|time|created|updated/i.test(c));
				const effectiveDateCol = date_column ?? (hasDateCol ? columns.find((c) => /date|time|created|updated/i.test(c))! : "created_at");

				const qualifiedTable = schema ? `${schema}.${table}` : table;

				// 执行每个图表的 SQL
				const charts: ChartResult[] = [];
				for (const chartConfig of preset.charts) {
					try {
						const sql = chartConfig.sqlTemplate
							.replace(/\{table\}/g, qualifiedTable)
							.replace(/\{dateCol\}/g, effectiveDateCol);

						const result = await engineExecuteByName(connection_name, sql, {
							rowLimit: chartConfig.config?.maxRows ?? 1000,
							timeoutMs: 30000,
							dbType: db_type,
						});

						charts.push({
							id: chartConfig.id,
							type: chartConfig.type,
							title: chartConfig.title,
							columns: result.columns,
							rows: result.rows,
							config: chartConfig.config,
							layout: chartConfig.layout,
						});
					} catch {
						charts.push({
							id: chartConfig.id,
							type: chartConfig.type,
							title: chartConfig.title,
							columns: [],
							rows: [],
							config: chartConfig.config,
							layout: chartConfig.layout,
						});
					}
				}

				const title = `${table} - ${preset.label}`;
				const html = generatePreviewHtml(title, charts);

				// ADR-0007：统一走 Canvas 流水线
				// 多查询结果集按列拼接成宽表，让 Canvas inferLayout 自动推断布局
				const { columns: mergedCols, rows: mergedRows } = mergeResultSets(
					charts.map((c) => ({ columns: c.columns, rows: c.rows })),
				);

				const viz = {
					title,
					type: "dashboard" as const,
					template,
					connection: connection_name,
					table,
					html,
					presetId: preset.id,
					// Canvas 优先：resultRows → inferLayout 自动布局
					resultColumns: mergedCols,
					resultRows: mergedRows,
					// Legacy fallback：保留 charts[] 供旧产物兼容
					charts,
				};

				// 始终持久化（callback 为 null 时产物也不会丢）
				saveVisualizationToStore(viz);
				showVisualizationPreview(viz);

				return {
					ok: true,
					connection: connection_name,
					table,
					template,
					title,
					charts,
					message: `看板「${title}」已生成。`,
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

function generatePreviewHtml(title: string, charts: ChartResult[]): string {
	const content = charts.map((chart) => {
		if (chart.type === "kpi_card") {
			const value = chart.rows[0]?.value ?? 0;
			return `<div class="kpi-card"><h3>${chart.title}</h3><div class="kpi-value">${value}</div></div>`;
		}
		const rows = chart.rows.slice(0, 20).map((r) => `<tr>${Object.values(r).map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("");
		const cols = chart.columns;
		return `<div class="table-card"><h3>${chart.title}</h3><div class="table-wrapper"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
	}).join("\n");

	return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; 
	background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); 
	color: #e2e8f0; 
	min-height: 100vh; 
	padding: clamp(16px, 3vw, 32px);
}
h1 { 
	text-align: center; 
	font-size: clamp(20px, 3vw, 32px); 
	margin-bottom: clamp(16px, 3vw, 32px); 
	background: linear-gradient(90deg, #3b82f6, #8b5cf6); 
	-webkit-background-clip: text; 
	-webkit-text-fill-color: transparent;
	background-clip: text;
}
.dashboard { 
	display: grid; 
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); 
	gap: clamp(12px, 2vw, 24px); 
	max-width: 1600px; 
	margin: 0 auto; 
}
.kpi-card { 
	background: rgba(30, 41, 59, 0.8); 
	border-radius: 12px; 
	padding: clamp(16px, 2vw, 24px); 
	border: 1px solid rgba(59, 130, 246, 0.3);
}
.kpi-card h3 { font-size: clamp(12px, 1.5vw, 14px); color: #94a3b8; margin-bottom: 8px; }
.kpi-value { font-size: clamp(24px, 4vw, 40px); font-weight: 700; color: #3b82f6; }
.chart-card, .table-card { 
	background: rgba(30, 41, 59, 0.8); 
	border-radius: 12px; 
	padding: clamp(12px, 2vw, 20px); 
	border: 1px solid rgba(139, 92, 246, 0.3);
	overflow: hidden;
}
.chart-card { grid-column: span 1; }
@media (min-width: 768px) {
	.chart-card { grid-column: span 2; }
}
@media (min-width: 1200px) {
	.dashboard { grid-template-columns: repeat(3, 1fr); }
	.chart-card { grid-column: span 2; }
	.table-card { grid-column: 1 / -1; }
}
.chart-card h3, .table-card h3 { 
	font-size: clamp(14px, 1.5vw, 16px); 
	margin-bottom: 12px; 
	color: #a5b4fc; 
}
.table-wrapper {
	overflow-x: auto;
	overflow-y: auto;
	max-height: 400px;
}
table { width: 100%; border-collapse: collapse; font-size: clamp(11px, 1.2vw, 13px); min-width: 600px; }
th { 
	background: rgba(59, 130, 246, 0.2); 
	padding: clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 14px); 
	text-align: left; 
	font-weight: 600; 
	color: #93c5fd;
	white-space: nowrap;
	position: sticky;
	top: 0;
	z-index: 10;
}
td { 
	padding: clamp(4px, 0.8vw, 8px) clamp(8px, 1.5vw, 14px); 
	border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
tr:hover td { background: rgba(59, 130, 246, 0.1); }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="dashboard">${content}</div>
</body>
</html>`;
}

/**
 * mergeResultSets — ADR-0007：把多个预设查询结果合并成一个宽表，
 * 让 Canvas inferLayout 统一走单数据源。缺失列填 null。
 */
function mergeResultSets(
	results: Array<{ columns: string[]; rows: Array<Record<string, unknown>> }>,
): { columns: string[]; rows: Array<Record<string, unknown>> } {
	const allCols = [...new Set(results.flatMap((r) => r.columns))];
	const rows = results.flatMap((r) =>
		r.rows.map((row) => {
			const merged: Record<string, unknown> = {};
			for (const c of allCols) merged[c] = row[c] ?? null;
			return merged;
		}),
	);
	return { columns: allCols, rows };
}
