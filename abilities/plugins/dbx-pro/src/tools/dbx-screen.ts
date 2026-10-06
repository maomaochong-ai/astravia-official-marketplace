/**
 * dbx_screen — 数据大屏生成工具。
 * 
 * 根据预设模板执行 SQL 查询，返回结构化数据供组件渲染。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, engineDescribeByName } from "../shared/services/engine-client";
import { showVisualizationPreview, saveVisualizationToStore } from "../features/visualization/visualization-bridge";
import { SCREEN_PRESETS } from "../features/visualization/presets/screen/presets";
import type { ScreenPreset, WidgetConfig } from "../features/visualization/presets/screen/presets";

export type ScreenTemplate = "data_command" | "business_intel" | "monitoring";

export interface DbxScreenInput {
	connection_name: string;
	tables: string[];
	template: ScreenTemplate;
	schema?: string;
	db_type?: string;
	title?: string;
	date_column?: string;
}

interface WidgetResult {
	id: string;
	type: string;
	title: string;
	columns: string[];
	rows: Array<Record<string, unknown>>;
	config?: WidgetConfig["config"];
	layout: WidgetConfig["layout"];
}

export function createDbxScreenTool(): PluginAgentToolRegistration<DbxScreenInput> {
	return {
		id: "dbx_screen",
		name: "dbx_screen",
		label: "数据大屏",
		description: [
			"Generate data visualization large screen from database tables using preset templates.",
			"Templates: data_command (command center), business_intel (BI dashboard), monitoring (system health).",
			"Returns structured data for component rendering with recharts.",
			"Use when user wants to create a large screen, data wall, or monitoring dashboard.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: { type: "string", description: "Database connection name." },
				tables: { type: "array", items: { type: "string" }, description: "Table names." },
				template: { type: "string", enum: ["data_command", "business_intel", "monitoring"], description: "Screen template." },
				schema: { type: "string", description: "Schema name (optional)." },
				db_type: { type: "string", description: "Database type." },
				title: { type: "string", description: "Custom title." },
				date_column: { type: "string", description: "Date column name. Auto-detected if omitted." },
			},
			required: ["connection_name", "tables", "template"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, tables, template, schema, db_type, title: customTitle, date_column } = input;

			if (!connection_name) return { ok: false, error: "connection_name is required" };
			if (!tables?.length) return { ok: false, error: "tables must be non-empty" };

			const table = tables[0];
			const preset = SCREEN_PRESETS.find((p) => p.id === template);
			if (!preset) return { ok: false, error: `Unknown template: ${template}` };

			try {
				// 自动检测日期列
				const desc = await engineDescribeByName(connection_name, { table, schema });
				const columns = desc.columns.map((c) => c.name);
				const hasDateCol = columns.some((c) => /date|time|created|updated/i.test(c));
				const effectiveDateCol = date_column ?? (hasDateCol ? columns.find((c) => /date|time|created|updated/i.test(c))! : "created_at");

				const qualifiedTable = schema ? `${schema}.${table}` : table;

				// 执行每个组件的 SQL
				const widgets: WidgetResult[] = [];
				for (const widgetConfig of preset.widgets) {
					try {
						const sql = widgetConfig.sqlTemplate
							.replace(/\{table\}/g, qualifiedTable)
							.replace(/\{dateCol\}/g, effectiveDateCol);

						const result = await engineExecuteByName(connection_name, sql, {
							rowLimit: widgetConfig.config?.maxRows ?? 1000,
							timeoutMs: 30000,
							dbType: db_type,
						});

						widgets.push({
							id: widgetConfig.id,
							type: widgetConfig.type,
							title: widgetConfig.title,
							columns: result.columns,
							rows: result.rows,
							config: widgetConfig.config,
							layout: widgetConfig.layout,
						});
					} catch {
						widgets.push({
							id: widgetConfig.id,
							type: widgetConfig.type,
							title: widgetConfig.title,
							columns: [],
							rows: [],
							config: widgetConfig.config,
							layout: widgetConfig.layout,
						});
					}
				}

				const title = customTitle ?? `${table} - ${preset.label}`;
				const subtitle = preset.id === "data_command" ? "实时数据总览 · 核心指标追踪" : preset.id === "business_intel" ? "多维度业务分析 · 趋势对比" : "系统健康度 · 性能指标";
				const html = generatePreviewHtml(title, subtitle, widgets);

				const viz = {
					title,
					type: "screen" as const,
					template,
					connection: connection_name,
					table,
					html,
					presetId: preset.id,
					widgets,
				};

				showVisualizationPreview(viz);
				saveVisualizationToStore(viz);

				return {
					ok: true,
					connection: connection_name,
					table,
					template,
					title,
					widgets,
					message: `大屏「${title}」已生成。`,
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

function generatePreviewHtml(title: string, subtitle: string, widgets: WidgetResult[]): string {
	const content = widgets.map((widget) => {
		const isStat = widget.type === "number_stat" || widget.type === "gauge";
		if (isStat) {
			const value = widget.rows[0]?.value ?? 0;
			const suffix = widget.type === "gauge" ? "%" : "";
			return `<div class="widget stat"><h3>${widget.title}</h3><div class="stat-value">${value}${suffix}</div></div>`;
		}
		const rows = widget.rows.slice(0, 30).map((r) => `<tr>${Object.values(r).map((v) => `<td>${v ?? ""}</td>`).join("")}</tr>`).join("");
		const cols = widget.columns;
		return `<div class="widget table"><h3>${widget.title}</h3><div class="table-scroll"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
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
	background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%); 
	color: #e2e8f0; 
	min-height: 100vh; 
	padding: clamp(12px, 2vw, 24px);
	overflow-x: hidden;
}
.header { text-align: center; margin-bottom: clamp(16px, 3vw, 32px); }
.header h1 { 
	font-size: clamp(24px, 4vw, 40px); 
	background: linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6); 
	-webkit-background-clip: text; 
	-webkit-text-fill-color: transparent;
	background-clip: text;
	margin-bottom: 8px;
}
.header p { font-size: clamp(12px, 1.5vw, 16px); color: #64748b; }
.screen { 
	display: grid; 
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); 
	grid-auto-rows: minmax(100px, auto);
	gap: clamp(12px, 2vw, 20px); 
	max-width: 1800px; 
	margin: 0 auto; 
}
@media (min-width: 768px) {
	.screen { grid-template-columns: repeat(4, 1fr); }
	.chart { grid-column: span 2; }
	.table { grid-column: span 4; }
}
.widget { 
	background: rgba(30, 41, 59, 0.9); 
	border-radius: 12px; 
	padding: clamp(12px, 2vw, 24px); 
	border: 1px solid rgba(59, 130, 246, 0.2);
	backdrop-filter: blur(8px);
	transition: transform 0.2s, box-shadow 0.2s;
}
.widget:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); }
.widget h3 { 
	font-size: clamp(11px, 1.2vw, 14px); 
	color: #94a3b8; 
	margin-bottom: 12px; 
	text-transform: uppercase; 
	letter-spacing: 0.5px;
}
.stat { display: flex; flex-direction: column; justify-content: center; align-items: center; }
.stat-value { 
	font-size: clamp(32px, 5vw, 56px); 
	font-weight: 800; 
	background: linear-gradient(135deg, #06b6d4, #3b82f6); 
	-webkit-background-clip: text; 
	-webkit-text-fill-color: transparent;
	background-clip: text;
}
.table-scroll { max-height: 300px; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: clamp(10px, 1.2vw, 13px); min-width: 500px; }
th { 
	background: rgba(59, 130, 246, 0.15); 
	padding: clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 14px); 
	text-align: left; 
	font-weight: 600; 
	color: #93c5fd;
	position: sticky;
	top: 0;
	white-space: nowrap;
}
td { 
	padding: clamp(4px, 0.8vw, 8px) clamp(8px, 1.5vw, 14px); 
	border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
tr:hover td { background: rgba(59, 130, 246, 0.08); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.widget { animation: fadeIn 0.5s ease-out forwards; opacity: 0; }
.widget:nth-child(1) { animation-delay: 0.1s; }
.widget:nth-child(2) { animation-delay: 0.2s; }
.widget:nth-child(3) { animation-delay: 0.3s; }
.widget:nth-child(4) { animation-delay: 0.4s; }
</style>
</head>
<body>
<div class="header">
<h1>${title}</h1>
<p>${subtitle}</p>
</div>
<div class="screen">${content}</div>
</body>
</html>`;
}
