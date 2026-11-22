import type { PluginConversationApi } from "@astravia-org/plugin-sdk";
import type { ChatOutcome } from "../state";

/**
 * `sendPrompt` 在宿主没有活动会话时抛错；其余错误（权限、模型、网络）不应该被
 * 当成「没会话」而静默新建，否则用户的会话会被顶掉。所以只认这一种错。
 *
 * 文案由宿主决定，不能假定它只说英文：宿主换一句 `no open conversation` 或
 * 「没有可用的对话」就足以让这里判错，所以模式覆盖常见措辞。
 */
export function looksLikeNoSession(error: unknown): boolean {
	const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
	return /no active|not active|no session|no conversation|no open|not opened|没有.*会话|没有.*对话|未打开/.test(message);
}

/**
 * 开一个新会话再把话送进去。
 *
 * `navigate: false` 是刻意的：面板本身是侧栏，对话就在它旁边。用默认值（true）时宿主
 * 会先跳到对话页、插件 tab 再把自己挂回来 —— 用户看到的就是「tab 闪一下」。会话照常创建
 * 并被设为活跃，只是不动路由，所以发出去的那句话仍然落在正确的会话里。
 */
export async function startSession(conversation: PluginConversationApi, prompt: string, cwd: string): Promise<ChatOutcome> {
	await conversation.createSession(cwd, { navigate: false });
	const created = await conversation.sendPrompt(prompt);
	if (created.status === "failed") throw new Error(created.error?.message ?? "sendPrompt failed");
	return "opened";
}

/**
 * 把一句话送进对话。
 *
 * `activeSession` 由宿主 replay 的 `conversation-changed` 给出：`null` 表示确定没有
 * 活跃会话，`undefined` 表示还没收到状态。前者直接新建，后者才用发送试探一次。
 */
export async function deliverPrompt(
	conversation: PluginConversationApi,
	prompt: string,
	cwd: string | null,
	activeSession: string | null | undefined,
): Promise<ChatOutcome> {
	if (!cwd) throw new Error("no workspace folder is attached to this panel");
	if (activeSession === null) return startSession(conversation, prompt, cwd);
	try {
		const result = await conversation.sendPrompt(prompt);
		if (result.status === "failed") throw new Error(result.error?.message ?? "sendPrompt failed");
		return result.status === "queued" ? "queued" : "sent";
	} catch (error) {
		if (!looksLikeNoSession(error)) throw error;
	}
	return startSession(conversation, prompt, cwd);
}
