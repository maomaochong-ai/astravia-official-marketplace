/**
 * 送达验证：「宿主回了 sent」不等于「对话里真的出现了这条消息」。
 *
 * 宿主的 `sendPrompt` 在会话切换空档、或桥接层兜底时仍可能回 `{ status: "sent" }`
 * （`plugin-host-bridge.ts` 里 `result ?? { status: "sent" }`），而对话区什么也没有。
 * 用户看到的就是「点了交给 Agent，对话框里没消息」，无法判断到底发没发出去。
 *
 * 宿主不在本插件的修改范围内，所以这里不赌回执：发出后自己订阅一次会话事件，
 * 直到看见 `role === "user"` 的消息（文本命中我们发的那条）或 `turn-start`，
 * 才认为送达；等不到就是「未确认」，如实告诉用户并给补救动作。
 */

import type { ConversationEvent, Disposable } from "@astravia-org/plugin-sdk";

/** 等多久算没送达。太短会把慢宿主判成失败，太长会让按钮一直转圈。 */
export const DELIVERY_TIMEOUT_MS = 2500;

/** 比对用的前缀长度：够长到不会撞车，又短到能容忍宿主在正文前插入附件行。 */
const PREFIX_LENGTH = 64;

export type DeliveryOutcome = "confirmed" | "turnStarted" | "timeout";

/** 折叠空白：宿主回显时会重排换行与缩进，逐字比对必然失败。 */
export function normalizePromptText(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}

/** 取比对前缀。按码位切，避免把代理对劈成半个字符。 */
export function promptPrefix(text: string): string {
	return Array.from(normalizePromptText(text)).slice(0, PREFIX_LENGTH).join("");
}

/**
 * 这条消息是不是我们刚发出去的那条。
 *
 * 用 `includes` 而不是 `startsWith`：宿主可能把 prompt 模板前缀、附件引用行插在
 * 正文之前，起始位置并不稳定；正文本身仍是逐字出现的。
 */
export function isDeliveredMessage(prefix: string, messageText: string): boolean {
	if (prefix.length === 0) return false;
	return normalizePromptText(messageText).includes(prefix);
}

/**
 * 订阅会话事件直到送达或超时。
 *
 * 只监听两种证据：
 *   - `message-added` 且是 user 消息、文本命中 —— 消息确实上屏了；
 *   - `turn-start` —— Agent 已经开始跑这一轮，说明 prompt 进了引擎。
 * 其余事件（tool-call-*、queue-changed）不能区分「我们这条」和别的东西，忽略。
 */
export function watchDelivery(
	subscribe: (listener: (event: ConversationEvent) => void) => Disposable,
	prompt: string,
	timeoutMs: number = DELIVERY_TIMEOUT_MS,
): Promise<DeliveryOutcome> {
	const prefix = promptPrefix(prompt);
	return new Promise<DeliveryOutcome>((resolve) => {
		let settled = false;
		let subscription: Disposable | null = null;
		const finish = (outcome: DeliveryOutcome): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			subscription?.dispose();
			resolve(outcome);
		};
		const timer = setTimeout(() => finish("timeout"), timeoutMs);
		try {
			subscription = subscribe((event) => {
				if (event.type === "turn-start") {
					finish("turnStarted");
					return;
				}
				if (event.type === "message-added" && event.message.role === "user" && isDeliveredMessage(prefix, event.message.text)) {
					finish("confirmed");
				}
			});
		} catch {
			// 宿主不支持订阅：退化成「等不到证据」，由调用方按未确认处理。
			finish("timeout");
		}
	});
}
