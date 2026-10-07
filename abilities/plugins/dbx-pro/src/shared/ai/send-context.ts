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

/** 构造看板生成 prompt（v0.0.103：引导宿主 Agent 自己编排图表 → dbx_chart_collection）。 */
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
		"1. 先查看表结构，了解列名和数据类型",
		"2. 自己写 SQL 查询，把数据整理成适合可视化的格式",
		"3. 用 render_chart 工具生成多个 Chart.js 图表（每个图表包含 type + data: {labels, datasets}）",
		"4. 最后用 dbx_chart_collection 工具把这些图表打包成完整看板页面（type=dashboard）",
		"",
		"dbx_chart_collection 输入格式：",
		"  - charts: 数组，每个元素 { type: 'line'|'bar'|'pie'|..., data: {labels, datasets}, title? }",
		"  - title: 页面标题",
		"  - type: 'dashboard'（浅色 QuickBI 风格）",
		"  - 最多 12 个图表，自动 Grid 布局",
		"",
		"建议搭配 KPI 指标卡 + 1-2 个趋势图 + 1 个分布图，形成均衡的看板布局。",
	);
	return lines.join("\n");
}

/** 构造大屏生成 prompt（v0.0.103：引导宿主 Agent 自己编排图表 → dbx_chart_collection）。 */
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
		"1. 先查看表结构，了解列名和数据类型",
		"2. 自己写 SQL 查询，把数据整理成适合大屏展示的格式",
		"3. 用 render_chart 工具生成多个 Chart.js 图表",
		"4. 最后用 dbx_chart_collection 工具把这些图表打包成完整大屏页面（type=screen）",
		"",
		"dbx_chart_collection 输入格式同上，只需把 type 改为 'screen'（深色 DataV 风格 + 入场动画）。",
		"大屏建议 6-12 个图表，混合 KPI 数字 + 趋势折线 + 分布图 + 占比饼图，形成高密度数据墙。",
	);
	return lines.join("\n");
}
