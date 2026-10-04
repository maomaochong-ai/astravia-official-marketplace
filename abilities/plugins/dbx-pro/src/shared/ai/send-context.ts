/**
 * 宿主 AI 交互 — 把连接 / 表 / 查询上下文发送给宿主 AI 会话。
 *
 * 交互链路（三级阶梯）：
 *   1. 检查 agent.session.read + agent.session.write 权限 → 未授权则 warn 后返回
 *   2. 探测活跃会话：conversation.on("conversation-changed") 等最多 3s
 *      - 有活跃会话 → sendPrompt(text)
 *      - 无活跃会话 → createSession(".") 成功后再 sendPrompt(text)
 *   3. 全部失败时降级为 insertText(text)，至少保证内容填入宿主输入框
 *
 * 设计参考：
 * - web-element-picker 的 hasActiveConversation（订阅 + 超时）
 * - astravia-ui-design handoff 的 createSession → sendPrompt 模式
 */

import type { ConversationEvent } from "@astravia-org/plugin-sdk";
import { getConversation, getPermissions } from "../../runtime-contract.ts";

export interface AiTableContext {
	connectionName: string;
	schema?: string;
	table: string;
}

export interface AiConnectionContext {
	connectionName: string;
	dbType: string;
}

/** 探测当前是否有活跃会话，最多等 3 秒。参考 web-element-picker 的 hasActiveConversation。 */
function hasActiveConversation(): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		let settled = false;
		let sub: { dispose(): void } | null = null;
		const finish = (value: boolean): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			sub?.dispose();
			resolve(value);
		};
		const timer = setTimeout(() => finish(false), 3000);
		try {
			sub = getConversation().on((event: ConversationEvent) => {
				if (event.type === "conversation-changed") finish(event.conversation.id !== null);
			});
		} catch {
			// 权限缺失等订阅失败场景：返回 false
			finish(false);
		}
	});
}

async function pushAiPrompt(prompt: string): Promise<void> {
	// ─── 第 0 级：权限预检 ───
	const perms = getPermissions();
	if (!perms.has("agent.session.read") || !perms.has("agent.session.write")) {
		console.warn(
			"[dbx-pro] AI 交互需要 agent.session.read + agent.session.write 权限，请在插件设置中授权。",
		);
		// 权限未授权时继续降级到 insertText（不阻塞用户操作）
	}

	const conv = getConversation();

	// ─── 第 1 级：探测活跃会话 ───
	let hasSession = false;
	try {
		hasSession = await hasActiveConversation();
	} catch {
		hasSession = false;
	}

	// ─── 第 2 级：有活跃会话 → 直接 sendPrompt ───
	if (hasSession) {
		try {
			const result = await conv.sendPrompt(prompt);
			if (result.status !== "failed") return;
			throw new Error(result.error?.message ?? "sendPrompt failed");
		} catch {
			// sendPrompt 在 streaming 中可能排队失败，继续走 createSession
		}
	}

	// ─── 第 3 级：无活跃会话 → createSession 后再 sendPrompt ───
	try {
		await conv.createSession(".", { navigate: true });
		const result = await conv.sendPrompt(prompt);
		if (result.status !== "failed") return;
		throw new Error(result.error?.message ?? "sendPrompt after createSession failed");
	} catch {
		// createSession / sendPrompt 全部失败
	}

	// ─── 最终降级：insertText（填入输入框，不自动发送） ───
	try {
		conv.insertText(prompt);
	} catch (err) {
		console.warn("[dbx-pro] 发送 AI 上下文失败（所有路径均已尝试）：", err);
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
