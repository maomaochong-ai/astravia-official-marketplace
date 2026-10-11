/**
 * dbx-report-builder —— jimureport 对等实现。
 *
 * 输入：SQL 模板 + 参数定义 + 分组 + 多级表头 + 内嵌图表
 * 输出：ECharts option + HTML 报表结构 + SQL 执行请求（交给 server/ 执行）
 *
 * 与 jimureport 的差异：jimureport 是平台 API 驱动（/jmreport/...），
 * dbx-pro 版本是纯 TypeScript 编译器——SQL 执行由 server/engine/dbx-mcp-client.mjs 完成。
 */

export interface ReportParameter {
	name: string;
	type: "string" | "number" | "date" | "enum";
	default?: unknown;
	options?: { label: string; value: unknown }[];
	required?: boolean;
}

export interface ReportHeader {
	label: string;
	column?: string;
	colspan?: number;
	align?: "left" | "center" | "right";
	children?: ReportHeader[];
}

export interface ReportChartSpec {
	title: string;
	type: "bar" | "line" | "pie" | "radar" | "gauge" | "funnel";
	/** 引用 SQL 结果里的列（x 列名 / y 列名） */
	xColumn?: string;
	yColumn?: string;
	groupColumn?: string;
}

export interface DbxReportBuilderInput {
	title: string;
	/** SQL 模板，? 占位符由 parameters 替换 */
	sql: string;
	parameters?: ReportParameter[];
	/** 分组列 → 自动小计/合计 */
	groups?: string[];
	/** 多级表头定义 */
	headers?: ReportHeader[];
	/** 内嵌图表（报表内联动） */
	charts?: ReportChartSpec[];
	/** 主题色 */
	palette?: string;
}

export interface BuiltReport {
	title: string;
	sql: string;
	parameters: ReportParameter[];
	headers: ReportHeader[];
	groups: string[];
	charts: ReportChartSpec[];
	/** 生成 HTML 所需的报表结构（由 server 执行完 SQL 后填数据） */
	templateHtml: string;
}

/** 编译报表 spec → BuiltReport */
export function dbxReportBuilder(input: DbxReportBuilderInput): BuiltReport {
	const parameters = input.parameters ?? [];
	const groups = input.groups ?? [];
	const charts = input.charts ?? [];
	const palette = input.palette ?? "tech";

	// 自动从 SQL 推断 headers（如果没给）
	const headers = input.headers ?? inferHeadersFromSql(input.sql);

	return {
		title: input.title,
		sql: input.sql,
		parameters,
		headers,
		groups,
		charts,
		templateHtml: buildReportTemplateHtml(input.title, headers, groups, charts, palette),
	};
}

/** 简单推断：SELECT 后取列名 */
function inferHeadersFromSql(sql: string): ReportHeader[] {
	const match = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
		.match(/select\s+([\s\S]*?)\s+from/i);
	if (!match) return [{ label: "数据", column: undefined }];

	const cols = match[1].split(",").map(c => c.trim())
		.filter(c => c && !/^(?:distinct|all)$/i.test(c))
		.map(c => {
			// alias：count(*) as cnt → cnt
			const alias = c.match(/\s+as\s+(\w+)$/i);
			if (alias) return alias[1];
			// 裸聚合函数 → fn_col
			const fn = c.match(/^(\w+)\(([^)]*)\)/);
			if (fn) return `${fn[1].toLowerCase()}_${fn[2].replace(/[*\s]/g, "").toLowerCase()}`;
			// 表前缀：t.column → column
			const prefix = c.match(/\.(\w+)$/);
			return prefix ? prefix[1] : c.split(".").pop()!;
		});

	return cols.map(col => ({ label: col, column: col }));
}

/** 生成空报表 HTML 结构（数据由 server 执行完 SQL 后填 rows） */
function buildReportTemplateHtml(
	title: string,
	headers: ReportHeader[],
	groups: string[],
	charts: ReportChartSpec[],
	_palette: string,
): string {
	const headRow = renderHeaderRow(headers);
	const groupHtml = groups.length
		? `<div class="report-groups" data-groups='${JSON.stringify(groups)}'></div>`
		: "";
	const chartHtml = charts.length
		? `<div class="report-charts">${charts.map((c, i) => `<div id="report-chart-${i}" class="report-chart" style="height:300px;"></div>`).join("")}</div>`
		: "";

	return `
<div class="dbx-report">
  <div class="report-title">${title}</div>
  <div class="report-table-wrapper">
    <table class="report-table">
      <thead>${headRow}</thead>
      <tbody class="report-body"><!-- rows injected --></tbody>
      <tfoot class="report-foot"><!-- totals injected --></tfoot>
    </table>
  </div>
  ${groupHtml}
  ${chartHtml}
</div>`;
}

function renderHeaderRow(headers: ReportHeader[]): string {
	const cells = headers.map(h => {
		if (h.children && h.children.length > 0) {
			return `<th colspan="${h.colspan ?? h.children.length}" style="text-align:${h.align ?? "center"};">${h.label}</th>`;
		}
		return `<th style="text-align:${h.align ?? "center"};">${h.label}</th>`;
	});
	return `<tr>${cells.join("")}</tr>`;
}
