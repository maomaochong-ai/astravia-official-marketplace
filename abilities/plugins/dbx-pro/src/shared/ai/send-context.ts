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

/** 构造查询结果分析 prompt（精简版，只包含 SQL，不包含结果 JSON）。 */
export function buildQueryPrompt(connectionName: string, sql: string, _sampleRows?: Record<string, unknown>[]): string {
	return [
		`我在连接 @\`${connectionName}\` 上执行了以下 SQL，请帮我分析结果：`,
		"```sql",
		sql,
		"```",
	].join("\n");
}
