import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 面板对话框 ↔ 宿主 AI：一条完整的往返（1.2.1）。
 *
 * 这条测试不是在读源码字符串，而是跑一遍真实的事件序列：用户在面板里敲一句 → 宿主的
 * `sendPrompt` 收到它 → 宿主回 `turn-start` → 宿主流式输出 → `message-added` 给出完整答复 →
 * `turn-end`。断言三件事：
 *
 *  1. 送到宿主的**就是我们敲的那句话**（不多不少、不重复）；
 *  2. 面板跟着离开首屏，并把宿主的答复压成要点（不是正文）；
 *  3. 往返之后停止键可用、再按一次会真的 `abort`。
 *
 * 宿主在这里是一个记录了调用的假实现——真实宿主的 `sendPrompt` 走
 * `pluginHostBridge.conversation.sendPrompt`（`apps/desktop/.../plugin-host-bridge.ts:742`），
 * 末尾再用 `session.sendMessage({ source: "plugin" })` 落进会话；这条测试覆盖插件这一侧的契约。
 */

const conversationState = {
	id: "session-live",
	cwd: "D:\\open-source-projects\\strix",
	sessionPath: "D:\\open-source-projects\\strix\\.astravia\\session-live.jsonl",
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

const host = {
	/** 面板交给宿主的每一句。 */
	prompts: [] as string[],
	/** 宿主被要求中断的次数。 */
	aborts: 0,
	/** 放进宿主输入框的文字（只在没有会话时走这条）。 */
	inserted: [] as string[],
	created: [] as string[],
};

vi.mock("@astravia-org/plugin-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@astravia-org/plugin-sdk")>();
	return { ...actual, useActiveConversation: () => conversationState };
});

const plugin = (await import("../src/index")).default;
const { forgetSnapshot } = await import("../src/features/scan-console/session-store");
const { setStrixEngaged } = await import("../src/domain/engagement");

afterEach(cleanup);

const realRaf = globalThis.requestAnimationFrame;
beforeEach(() => {
	forgetSnapshot(conversationState.id);
	conversationState.isStreaming = false;
	host.prompts.length = 0;
	host.aborts = 0;
	host.inserted.length = 0;
	host.created.length = 0;
	setStrixEngaged(false);
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		callback(0);
		return 0;
	}) as typeof requestAnimationFrame;
});
afterEach(() => {
	globalThis.requestAnimationFrame = realRaf;
});

function mount() {
	const listeners: Array<(event: unknown) => void> = [];
	let tab: { component: () => React.ReactElement } | undefined;
	const ctx = {
		plugin: { id: "strix", version: "1.2.1" },
		i18n: { t: (key: string) => key },
		ui: {
			registerActivityTab: (contribution: { component: () => React.ReactElement }) => {
				tab = contribution;
				return { dispose() {} };
			},
			registerInputAction: () => ({ dispose() {} }),
			registerShortcutScope: () => ({ dispose() {} }),
			setActivityTabVisible: () => undefined,
			openActivityTab: () => undefined,
			notify: () => undefined,
		},
		conversation: {
			on: (next: (event: unknown) => void) => {
				listeners.push(next);
				return {
					dispose() {
						const index = listeners.indexOf(next);
						if (index >= 0) listeners.splice(index, 1);
					},
				};
			},
			sendPrompt: async (text: string) => {
				host.prompts.push(text);
				return { status: "sent" as const };
			},
			insertText: (text: string) => host.inserted.push(text),
			createSession: async (cwd: string) => {
				host.created.push(cwd);
				return conversationState;
			},
			abort: async () => {
				host.aborts += 1;
			},
		},
		fileExplorer: { getWorkspaceRoots: () => [{ path: conversationState.cwd }] },
		services: {
			getStatus: async () => ({ phase: "stopped", installed: true }),
			start: async () => ({ phase: "ready", installed: true }),
			connection: async () => ({ baseUrl: "http://127.0.0.1:9" }),
			install: async () => ({ phase: "ready", installed: true }),
			onStatusChange: () => ({ dispose() {} }),
		},
	} as unknown as Parameters<typeof plugin.activate>[0];

	return {
		ctx,
		emit: (event: unknown) => listeners.forEach((next) => next(event)),
		tab: () => tab,
	};
}

const flush = async (): Promise<void> => {
	for (let index = 0; index < 2; index += 1) {
		await act(async () => {
			await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		});
	}
};

/** 在面板输入框里敲一句并点发送。 */
async function typeAndSend(container: HTMLElement, text: string): Promise<void> {
	const input = container.querySelector("textarea");
	if (!input) throw new Error("没有输入框");
	fireEvent.change(input, { target: { value: text } });
	const send = [...container.querySelectorAll("button")].find((button) => button.textContent === "composer.send");
	if (!send) throw new Error("没有发送键");
	fireEvent.click(send);
	await flush();
}

describe("panel composer ↔ host AI", () => {
	it("carries exactly the sentence the user typed into the host conversation", async () => {
		const harness = mount();
		await plugin.activate(harness.ctx);
		const view = render(harness.tab()!.component());
		await flush();

		await typeAndSend(view.container, "测 staging.example.com 的登录，只打 443");

		// 一个字都不改、不重复、不吞。
		expect(host.prompts).toEqual(["测 staging.example.com 的登录，只打 443"]);
		// 有会话时不建新会话、也不塞宿主输入框。
		expect(host.created).toEqual([]);
		expect(host.inserted).toEqual([]);
		// 宿主只转发 assistant 的消息，所以“我说的”这行由面板自己补上（摘要，不是正文）。
		const you = [...view.container.querySelectorAll('.astra-strix-say-row[data-from="you"]')].map((node) => node.textContent ?? "");
		expect(you.join(" ")).toContain("只打 443");
	});

	it("leaves the launch screen as soon as the host starts the turn", async () => {
		const harness = mount();
		await plugin.activate(harness.ctx);
		const view = render(harness.tab()!.component());
		await flush();

		await typeAndSend(view.container, "扫一下 demo.test");
		// 宿主开始跑（真实宿主由 session 事件翻译成 turn-start）。
		conversationState.isStreaming = true;
		await act(async () => {
			harness.emit({ type: "turn-start" });
		});
		await flush();

		expect(view.container.querySelector(".astra-strix-launch")).toBeNull();
		expect(view.container.querySelector(".astra-strix-workbench")).not.toBeNull();
	});

	it("brings the host's answer back as points, tagged by direction", async () => {
		const harness = mount();
		await plugin.activate(harness.ctx);
		const view = render(harness.tab()!.component());
		await flush();

		await typeAndSend(view.container, "看看 /api/orders 有没有越权");
		await act(async () => {
			harness.emit({ type: "turn-start" });
			harness.emit({
				type: "message-added",
				message: { id: "u1", role: "user", text: "看看 /api/orders 有没有越权" },
			});
			harness.emit({
				type: "message-added",
				message: {
					id: "a1",
					role: "assistant",
					text: [
						"我先读了路由和鉴权中间件，没有看到明显的注入点。",
						"确认一处越权：普通用户把 order id 换成别人的即可读取，severity high，影响 /api/orders/42。",
						"另外两条线索需要有效凭据才能继续，记在笔记里了。",
					].join("\n\n"),
				},
			});
			harness.emit({ type: "turn-end", stopReason: "end" });
		});
		await flush();

		const you = [...view.container.querySelectorAll('.astra-strix-say-row[data-from="you"]')].map((node) => node.textContent ?? "");
		const agent = [...view.container.querySelectorAll('.astra-strix-say-row[data-from="agent"]')].map((node) => node.textContent ?? "");

		// 我说的那句：一行，就是原话（这里原话本来就短）。
		expect(you.join(" ")).toContain("/api/orders");
		// 它说的：留住结论那一行，过渡句不进面板。
		expect(agent.join(" ")).toContain("越权");
		expect(agent.join(" ")).not.toContain("我先读了路由");
		// 正文没有整段搬进来。
		expect(view.container.textContent).not.toContain("另外两条线索需要有效凭据才能继续");
	});

	it("can stop the turn it is watching, and only through the host", async () => {
		const harness = mount();
		await plugin.activate(harness.ctx);
		const view = render(harness.tab()!.component());
		await flush();

		await typeAndSend(view.container, "继续");
		conversationState.isStreaming = true;
		await act(async () => {
			harness.emit({ type: "turn-start" });
		});
		await flush();

		const stop = view.container.querySelector(".astra-strix-band-stop") as HTMLButtonElement | null;
		expect(stop).toBeTruthy();
		expect(stop!.disabled).toBe(false);
		fireEvent.click(stop!);
		await flush();
		expect(host.aborts).toBe(1);
	});

	it("falls back to the host composer only when there is no conversation to send into", async () => {
		const harness = mount();
		await plugin.activate(harness.ctx);
		const view = render(harness.tab()!.component());
		await flush();

		// 模拟宿主拒绝：会话还没建好。
		const ctx = harness.ctx as unknown as { conversation: { sendPrompt: (text: string) => Promise<{ status: string }> } };
		ctx.conversation.sendPrompt = async () => ({ status: "failed" });
		await typeAndSend(view.container, "先看看 10.0.0.5");

		// 有 cwd：面板自己建会话，然后重发一次。
		expect(host.created).toEqual([conversationState.cwd]);
		expect(host.prompts).toEqual([]);
	});
});
