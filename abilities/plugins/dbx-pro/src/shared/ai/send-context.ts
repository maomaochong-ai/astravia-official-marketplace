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
