/**
 * 宿主 AI 交互 — 把连接 / 表 / 查询上下文发送给宿主 AI 会话。
 *
 * 优先 insertText（填入当前会话输入框，不自动发送）；不可用时（无活跃输入框、
 * 宿主拒绝等）降级 sendPrompt 直接发为用户消息，再退化为 createSession 新建会话。
 * 三级兜底，不静默失败。
 */

import { getConversation } from "../../runtime-contract.ts";

export interface AiTableContext {
	connectionName: string;
	schema?: string;
	table: string;
}

export interface AiConnectionContext {
	connectionName: string;
	dbType: string;
}

async function pushAiPrompt(prompt: string): Promise<void> {
	const conv = getConversation();
	try {
		conv.insertText(prompt);
		return;
	} catch {
		// insertText 不可用（无活跃会话 / 宿主拒绝）时继续走 sendPrompt
	}
	try {
		const result = await conv.sendPrompt(prompt);
		if (result.status !== "failed") return;
		throw new Error(result.error?.message ?? "sendPrompt failed");
	} catch (err) {
		try {
			await conv.createSession(".", { navigate: true });
			await conv.sendPrompt(prompt);
		} catch (err2) {
			console.warn("[dbx-pro] 发送 AI 上下文失败：", err2 ?? err);
		}
	}
}

/** 表分析上下文：让 AI 基于限定名做结构 / 数据探查。 */
export function sendTableToAi({ connectionName, schema, table }: AiTableContext): void {
	const qualified = schema ? `${schema}.${table}` : table;
	const prompt = [
		`请帮我分析数据库连接「${connectionName}」中的表 ${qualified}。`,
		`可以先查看表结构（列、类型、主键），再抽样数据了解其内容与用途：`,
		`SELECT * FROM ${qualified} LIMIT 100;`,
	].join("\n");
	void pushAiPrompt(prompt);
}

/** 连接分析上下文。 */
export function sendConnectionToAi({ connectionName, dbType }: AiConnectionContext): void {
	const prompt = [
		`请帮我了解 ${dbType} 数据库连接「${connectionName}」。`,
		`可以先列出其中的表，再挑选关键表分析结构与样本数据。`,
	].join("\n");
	void pushAiPrompt(prompt);
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
	void pushAiPrompt(parts.join("\n"));
}
