/**
 * 宿主 AI 交互 — 把连接 / 表 / 查询上下文注入当前会话输入框。
 *
 * 通过 runtime-contract 取 conversation 门面（insertText：填入输入栏但不自动发送，
 * 用户可编辑后再交给 AI），不直接调用模型，避免越权发送。
 */

import { getConversation } from "../../runtime-contract";

export interface AiTableContext {
	connectionName: string;
	schema?: string;
	table: string;
}

export interface AiConnectionContext {
	connectionName: string;
	dbType: string;
}

/** 表分析上下文：让 AI 基于限定名做结构 / 数据探查。 */
export function sendTableToAi({ connectionName, schema, table }: AiTableContext): void {
	const qualified = schema ? `${schema}.${table}` : table;
	const prompt = [
		`请帮我分析数据库连接「${connectionName}」中的表 ${qualified}。`,
		`可以先查看表结构（列、类型、主键），再抽样数据了解其内容与用途：`,
		`SELECT * FROM ${qualified} LIMIT 100;`,
	].join("\n");
	getConversation().insertText(prompt);
}

/** 连接分析上下文。 */
export function sendConnectionToAi({ connectionName, dbType }: AiConnectionContext): void {
	const prompt = [
		`请帮我了解 ${dbType} 数据库连接「${connectionName}」。`,
		`可以先列出其中的表，再挑选关键表分析结构与样本数据。`,
	].join("\n");
	getConversation().insertText(prompt);
}

/** 查询结果分析：把正在查看的 SQL 交给 AI，并可附带少量结果。 */
export function sendQueryToAi(connectionName: string, sql: string, sampleRows?: Record<string, unknown>[]): void {
	const parts = [
		`我在连接「${connectionName}」上执行了以下 SQL，请帮我分析结果：`,
		"```sql",
		sql,
		"```",
	];
	if (sampleRows && sampleRows.length > 0) {
		const preview = sampleRows.slice(0, 20);
		parts.push("部分结果（JSON）：", "```json", JSON.stringify(preview, null, 2), "```");
	}
	getConversation().insertText(parts.join("\n"));
}
