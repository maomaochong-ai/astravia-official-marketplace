/**
 * 宿主 AI 交互 — 构造数据库上下文 prompt 文本，供调用方决定发送方式。
 *
 * 本模块只负责「构造 prompt」，不再负责「发送」。
 * 发送由调用方通过 send-to-ai-dialog 组件统一处理：
 *   - 直接发送（sendPrompt → createSession → insertText 降级）
 *   - 仅填入输入框（insertText）
 *
 * @ 提及格式：
 *   表引用：`` @`连接名:schema.表名` ``
 *   连接引用：`` @`连接名` ``
 */

export interface AiTableContext {
	connectionName: string;
	schema?: string;
	table: string;
}

export interface AiConnectionContext {
	connectionName: string;
	dbType: string;
}

/** 构造表分析 prompt（精简版，不包含抽样数据）。 */
export function buildTablePrompt({ connectionName, schema, table }: AiTableContext): string {
	const qualified = schema ? `${schema}.${table}` : table;
	return [
		`请帮我分析数据库连接 @\`${connectionName}\` 中的表 @\`${qualified}\`。`,
		`请先查看表结构（列、类型、主键），了解其内容与用途。`,
	].join("\n");
}

/** 构造连接分析 prompt（精简版，只分析连接本身）。 */
export function buildConnectionPrompt({ connectionName, dbType }: AiConnectionContext): string {
	return [
		`请帮我了解 ${dbType} 数据库连接 @\`${connectionName}\`。`,
		`请先列出该连接中的可用表。`,
	].join("\n");
}

/** 多选对象的节点信息（由连接树在勾选时收集）。 */
export interface SelectedNodeInfo {
	kind: "connection" | "schema" | "table";
	connectionName: string;
	/** schema 名（table 节点所属 schema）。 */
	schema?: string;
	/** 节点显示名（连接名 / schema 名 / 表名）。 */
	label: string;
}

/**
 * 构造多选对象的上下文 prompt。
 * 按连接分组列出选中的 schema / 表引用（精简版，让 AI 自行查看结构，
 * 与单表 / 连接 prompt 的风格一致，避免一次塞入大量 DDL）。
 */
export function buildMultiSelectPrompt(nodes: SelectedNodeInfo[]): string {
	const groups = new Map<string, SelectedNodeInfo[]>();
	for (const node of nodes) {
		if (!groups.has(node.connectionName)) groups.set(node.connectionName, []);
		groups.get(node.connectionName)!.push(node);
	}
	const lines: string[] = ["我在数据库工作台选择了以下对象，请作为本次任务的上下文：", ""];
	for (const [conn, items] of groups) {
		lines.push(`连接 @\`${conn}\`：`);
		for (const it of items) {
			if (it.kind === "connection") {
				lines.push("- 整个连接：请先列出它的 schema 与表");
			} else if (it.kind === "schema") {
				lines.push(`- 数据库/Schema @\`${it.label}\``);
			} else {
				const qualified = it.schema ? `${it.schema}.${it.label}` : it.label;
				lines.push(`- 表 @\`${qualified}\``);
			}
		}
	}
	lines.push("", "请先查看上述对象的结构（列、类型、主键），再基于它们回答我后续的问题。");
	return lines.join("\n");
}

/** 构造查询结果分析 prompt（精简版，只包含 SQL，不包含结果 JSON）。 */
export function buildQueryPrompt(connectionName: string, sql: string, _sampleRows?: Record<string, unknown>[]): string {
	return [
		`我在连接 @\`${connectionName}\` 上执行了以下 SQL，请帮我分析结果：`,
		"```sql",
		sql,
		"```",
	].join("\n");
}

/** 从查询结果生成看板/大屏 prompt —— 结果面板"AI 可视化"按钮用。 */
export function buildResultVizPrompt(
	connectionName: string,
	sql: string,
	intent: "dashboard" | "screen",
	columns: string[],
	rowCount: number,
): string {
	const themeName = intent === "dashboard" ? "看板" : "大屏";
	const intentWork = intent === "dashboard"
		? "浅色调企业看板"
		: "深色调数据大屏（6-12 个图表形成高密度数据墙）";
	return [
		`我在连接 @\`${connectionName}\` 上执行了一条 SQL，结果有 ${rowCount} 行 ${columns.length} 列。`,
		"",
		"SQL：",
		"```sql",
		sql,
		"```",
		"",
		`请基于这条 SQL 为我生成${themeName}（${intentWork}）。`,
		"",
		"工作流（双路径）：",
		"1. 先检查 SQL —— 如果返回的是明细行（大量原始行），请写聚合 SQL（GROUP BY + SUM/COUNT/AVG）再查",
		"2. 用 dbx_query_full 工具执行 SQL 拿完整聚合数据（自动分页拼页，绕过 1000 行截断）",
		"   - 不要用 dbx MCP execute_query——它单次最多 1000 行，会截断",
		"   - dbx_query_full 默认 maxRows=2000，如果聚合维度超过 2000 行，可按需增大",
		"3. 将 dbx_query_full 的 rows 转成 Chart.js 图表（charts[] 数组），数据结构：",
		"   { type: 'line'|'bar'|'pie'|..., data: { labels: [...], datasets: [...] }, title: '...' }",
		"4. 宿主 render_chart（对话 UI 原生卡片）—— 先挑 1-4 个核心图表调宿主的 render_chart 工具，",
		"   让用户在当前对话中看到原生风格的图表预览（和宿主聊天窗口里的图表视觉一致）",
		"5. dbx_chart_collection（BI 数据资产）—— 把所有图表打包成完整的 HTML 页面存进数据库工作台的",
		`   BI 数据资产（type=${intent}，title 取一个有意义的名称，connection_name="${connectionName}",`,
		`   sql="${sql.replace(/"/g, '\\"')}"），用户点击顶部栏的「BI」按钮就能在新标签页查看和二次编辑`,
		"",
		"图表选择原则（根据数据特点决定，不要套固定模板）：",
		"  - 时间维度 → line（折线）或 bar（柱状按时间）",
		"  - 排名/对比 → bar（横向条形图）",
		"  - 占比/份额 → pie 或 doughnut（分类 ≤ 8 时效果好）",
		"  - 多维对比 → radar",
		"  - 两变量相关性 → scatter",
		"  - 大屏核心指标 → bar 配合单值聚合 + 大字号标题",
		"  - 分类太多（> 8）→ horizontal bar + LIMIT 20",
	].join("\n");
}

/** 构造看板生成 prompt（dbx_query_full 完整查询 + 数据驱动图表）。 */
export function buildDashboardPrompt(nodes: SelectedNodeInfo[]): string {
	const tables = nodes.filter((n) => n.kind === "table");
	if (tables.length === 0) return "请先选择要生成看板的表。";

	const groups = new Map<string, SelectedNodeInfo[]>();
	for (const node of tables) {
		if (!groups.has(node.connectionName)) groups.set(node.connectionName, []);
		groups.get(node.connectionName)!.push(node);
	}

	const lines: string[] = ["请帮我为以下数据库表生成企业看板：", ""];
	for (const [conn, items] of groups) {
		lines.push(`连接 @\`${conn}\`：`);
		for (const it of items) {
			const qualified = it.schema ? `${it.schema}.${it.label}` : it.label;
			lines.push(`- 表 @\`${qualified}\``);
		}
	}
	lines.push(
		"",
		"工作流：",
		"1. 先查看表结构（dbx_describe_table），了解列名和数据类型",
		"2. 写聚合 SQL（GROUP BY + SUM/COUNT/AVG/MAX/MIN）",
		"3. 用 dbx_query_full 工具执行 SQL 拿完整聚合数据（自动分页拼页，绕过 1000 行截断）",
		"   - 不要用 dbx MCP execute_query——它单次最多 1000 行，会截断",
		"   - dbx_query_full 默认 maxRows=2000，如果聚合维度超过 2000 行，可按需增大",
		"   - 如果返回 note 说 Result truncated，说明还有数据没拉完——增大 maxRows 重跑",
		"4. 用 render_chart 工具生成 Chart.js 图表（把 dbx_query_full 返回的 rows 转成 Chart.js data）",
		"   - 每次 render_chart 最多 4 图，可分多批次调用",
		"5. 最后用 dbx_chart_collection 打包成完整看板页面（type=dashboard）",
		"",
		"图表选择原则（根据数据特点决定，不要套固定模板）：",
		"  - 时间维度 → line（折线）或 bar（柱状按时间）",
		"  - 排名/对比 → bar（横向条形图更适合长标签）",
		"  - 占比/份额 → pie 或 doughnut（分类 ≤ 6 时效果好）",
		"  - 多维对比 → radar（多指标雷达图）",
		"  - 两变量相关性 → scatter（散点图）",
		"  - 三变量（x/y/量）→ bubble（气泡图）",
		"  - 分类太多（> 8）→ horizontal bar + LIMIT 20",
		"",
		"让数据说话——根据查到的数据分布和业务含义，自己决定用什么图表、多少个、怎么组合。",
	);
	return lines.join("\n");
}

/** 构造大屏生成 prompt（dbx_query_full 完整查询 + 数据驱动图表）。 */
export function buildScreenPrompt(nodes: SelectedNodeInfo[]): string {
	const tables = nodes.filter((n) => n.kind === "table");
	if (tables.length === 0) return "请先选择要生成大屏的表。";

	const groups = new Map<string, SelectedNodeInfo[]>();
	for (const node of tables) {
		if (!groups.has(node.connectionName)) groups.set(node.connectionName, []);
		groups.get(node.connectionName)!.push(node);
	}

	const lines: string[] = ["请帮我为以下数据库表生成数据大屏：", ""];
	for (const [conn, items] of groups) {
		lines.push(`连接 @\`${conn}\`：`);
		for (const it of items) {
			const qualified = it.schema ? `${it.schema}.${it.label}` : it.label;
			lines.push(`- 表 @\`${qualified}\``);
		}
	}
	lines.push(
		"",
		"工作流：",
		"1. 先查看表结构（dbx_describe_table），了解列名和数据类型",
		"2. 写聚合 SQL（GROUP BY + SUM/COUNT/AVG/MAX/MIN）",
		"3. 用 dbx_query_full 工具执行 SQL 拿完整聚合数据（自动分页拼页，绕过 1000 行截断）",
		"   - 不要用 dbx MCP execute_query——它单次最多 1000 行，会截断",
		"   - dbx_query_full 默认 maxRows=2000，如果聚合维度超过 2000 行，可按需增大",
		"   - 如果返回 note 说 Result truncated，说明还有数据没拉完——增大 maxRows 重跑",
		"4. 用 render_chart 工具生成 Chart.js 图表（把 dbx_query_full 返回的 rows 转成 Chart.js data）",
		"   - 每次 render_chart 最多 4 图，可分多批次调用",
		"5. 最后用 dbx_chart_collection 打包成完整大屏页面（type=screen）",
		"",
		"图表选择原则（根据数据特点决定，不要套固定模板）：",
		"  - 时间维度 → line（折线）或 bar（柱状按时间）",
		"  - 排名/对比 → bar（横向条形图）",
		"  - 占比/份额 → pie 或 doughnut（分类 ≤ 6）",
		"  - 多维对比 → radar",
		"  - 两变量相关性 → scatter",
		"  - 大屏核心指标 → bar 配合单值聚合 + 大字号标题",
		"  - 分类太多（> 8）→ horizontal bar + LIMIT 20",
		"",
		"让数据说话——根据查到的数据分布和业务含义，自己决定组合。大屏建议 6-12 个图表形成高密度数据墙。",
	);
	return lines.join("\n");
}
