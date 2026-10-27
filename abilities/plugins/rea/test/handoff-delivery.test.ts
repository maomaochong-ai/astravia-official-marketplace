/**
 * 送达验证的边界。
 *
 * 这里锁的不是「宿主会怎么做」，而是「我们凭什么认为消息发出去了」：
 * 只认对话事件里的用户消息或 turn-start，其余一律算未确认。
 */

import { describe, expect, it, vi } from "vitest";
import type { ConversationEvent, Disposable } from "@astravia-org/plugin-sdk";
import {
	DELIVERY_TIMEOUT_MS,
	isDeliveredMessage,
	normalizePromptText,
	promptPrefix,
	watchDelivery,
} from "../src/features/rea-workflow/live/handoff-delivery";

function channel(): {
	subscribe: (listener: (event: ConversationEvent) => void) => Disposable;
	emit(event: ConversationEvent): void;
	dispose: ReturnType<typeof vi.fn>;
} {
	let listener: ((event: ConversationEvent) => void) | null = null;
	const dispose = vi.fn();
	return {
		subscribe: (next) => {
			listener = next;
			return { dispose };
		},
		emit: (event) => listener?.(event),
		dispose,
	};
}

function userMessage(text: string): ConversationEvent {
	return { type: "message-added", message: { id: `m-${text.length}`, role: "user", text } };
}

describe("文本归一", () => {
	it("折叠空白，重排过的回显也能比对", () => {
		expect(normalizePromptText("  用 REA\n分析 /tmp/a.apk\t。 ")).toBe("用 REA 分析 /tmp/a.apk 。");
	});

	it("前缀按码位截断，不劈开代理对", () => {
		const prefix = promptPrefix("😀".repeat(100));
		expect(prefix).toBe("😀".repeat(64));
		expect(prefix.length).toBe(128);
	});

	it("前缀有上限，长 prompt 不会被整段搬运", () => {
		expect(Array.from(promptPrefix("a".repeat(500))).length).toBe(64);
	});
});

describe("消息比对", () => {
	const prompt = "用 REA 分析 /Applications/QQ.app（目标类型：Electron / JS）";
	const prefix = promptPrefix(prompt);

	it("正文逐字出现即算命中", () => {
		expect(isDeliveredMessage(prefix, prompt)).toBe(true);
	});

	it("宿主在前面插了附件行也算命中", () => {
		expect(isDeliveredMessage(prefix, `@/Applications/QQ.app\n\n${prompt}`)).toBe(true);
	});

	it("不相干的用户消息不算", () => {
		expect(isDeliveredMessage(prefix, "帮我看看这个 apk")).toBe(false);
	});

	it("空前缀不算命中", () => {
		expect(isDeliveredMessage("", "")).toBe(false);
	});
});

describe("等待送达", () => {
	it("看见那条用户消息就确认，并退订", async () => {
		const ch = channel();
		const waiting = watchDelivery(ch.subscribe, "用 REA 分析 /tmp/a.apk", 1000);
		ch.emit(userMessage("用 REA 分析 /tmp/a.apk"));
		await expect(waiting).resolves.toBe("confirmed");
		expect(ch.dispose).toHaveBeenCalledTimes(1);
	});

	it("assistant 复述同样文字不算送达", async () => {
		const ch = channel();
		const waiting = watchDelivery(ch.subscribe, "用 REA 分析 /tmp/a.apk", 20);
		ch.emit({ type: "message-added", message: { id: "a1", role: "assistant", text: "用 REA 分析 /tmp/a.apk" } });
		await expect(waiting).resolves.toBe("timeout");
	});

	it("turn-start 也算进了引擎，但区分于消息上屏", async () => {
		const ch = channel();
		const waiting = watchDelivery(ch.subscribe, "用 REA 分析 /tmp/a.apk", 1000);
		ch.emit({ type: "turn-start" });
		await expect(waiting).resolves.toBe("turnStarted");
		expect(ch.dispose).toHaveBeenCalledTimes(1);
	});

	it("什么都等不到就是 timeout —— 回执不能当证据", async () => {
		const ch = channel();
		const waiting = watchDelivery(ch.subscribe, "用 REA 分析 /tmp/a.apk", 10);
		await expect(waiting).resolves.toBe("timeout");
		expect(ch.dispose).toHaveBeenCalledTimes(1);
	});

	it("宿主不支持订阅时直接判未确认，不抛错", async () => {
		const waiting = watchDelivery(() => {
			throw new Error("conversation.on unavailable");
		}, "用 REA 分析 /tmp/a.apk", 10);
		await expect(waiting).resolves.toBe("timeout");
	});

	it("默认超时是 2.5 秒：短到不让按钮一直转圈", () => {
		expect(DELIVERY_TIMEOUT_MS).toBe(2500);
	});
});
