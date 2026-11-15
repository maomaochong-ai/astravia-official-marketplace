import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 会话隔离（4.1）。
 *
 * 用户报的是：在 A 项目开面板跑评估，切到 B 项目，在面板上按"停止生成"，
 * B 项目正在跑的普通对话被终止了。根因在宿主：`conversation.abort()` 不看面板，
 * 打的是 `activeSessionAtom` 里的会话（plugin-host-bridge）。所以插件侧必须自己收口：
 * **停只能停本面板发起的那一轮，且只在它绑定的那个会话里。**
 *
 * 这里钉住可观察的两条：换到别的会话后停止键是灰的、按下去不会触发 abort。
 */

const conversationState = {
	id: "session-a",
	cwd: "D:\\open-source-projects\\alpha",
	sessionPath: "D:\\open-source-projects\\alpha\\.astravia\\a.jsonl",
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

const aborted: string[] = [];
const sent: string[] = [];

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
	// 先归位再清快照：上一条用例可能把 id 改成了 session-b 或 team-1，
	// 用旧的 id 去 forget 会漏掉 session-a，下一条用例就会从“上一个用例的现场”开局。
	for (const id of ["session-a", "session-b", "team-1"]) forgetSnapshot(id);
	conversationState.id = "session-a";
	conversationState.sessionPath = "D:\\open-source-projects\\alpha\\.astravia\\a.jsonl";
	conversationState.isStreaming = false;
	aborted.length = 0;
	sent.length = 0;
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
		plugin: { id: "strix", version: "1.0.13" },
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
				sent.push(text);
				return { status: "sent" };
			},
			insertText: () => undefined,
			abort: async () => {
				aborted.push(conversationState.id);
			},
			createSession: async () => conversationState,
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

function stopButton(container: HTMLElement): HTMLButtonElement {
	const node = container.querySelector(".astra-strix-band-stop");
	if (!node) throw new Error("no stop button rendered");
	return node as HTMLButtonElement;
}

/** 面板发一句话，让这一轮归它所有（这是停止键唯一的合法性来源）。 */
async function startRunFromPanel(container: HTMLElement): Promise<void> {
	const box = container.querySelector("textarea");
	if (!box) throw new Error("no composer textarea");
	fireEvent.change(box, { target: { value: "scan this" } });
	const send = [...container.querySelectorAll("button")].find((button) => button.textContent === "composer.send");
	if (!send) throw new Error("no send button");
	fireEvent.click(send);
	await flush();
	await flush();
}

describe("stop belongs to the run, not to whatever the host is streaming", () => {
	it("stays enabled in the conversation that started the run", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();

		await startRunFromPanel(utils.container);
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		expect(sent).toHaveLength(1);
		expect(stopButton(utils.container).disabled).toBe(false);
	});

	it("goes grey when the host starts a turn of its own", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();

		// 同一个会话，但这一轮是用户在宿主自己的输入框里发的：
		// 面板没有发起它，就没有资格停它（真机上被终止的普通对话就是这个）。
		await startRunFromPanel(utils.container);
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();
		expect(stopButton(utils.container).disabled).toBe(false);

		await act(async () => {
			host.emit({ type: "turn-end", stopReason: "end" });
			host.emit({ type: "turn-start" });
		});
		await flush();

		expect(stopButton(utils.container).disabled).toBe(true);
		fireEvent.click(stopButton(utils.container));
		await flush();
		expect(aborted).toHaveLength(0);
	});

	it("never reaches across conversations after the host switches", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();

		await startRunFromPanel(utils.container);
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		// 用户切到另一个项目：面板重绑到那个会话，自己的运行留在 A。
		conversationState.id = "session-b";
		conversationState.sessionPath = "D:\\open-source-projects\\beta\\.astravia\\b.jsonl";
		conversationState.isStreaming = true;
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		// 面板画的是 B 自己的现场（它是空的），而不是替 A 接着发光；
		// 更关键的是：没有任何东西能停到 B 这一轮。
		expect(aborted).toHaveLength(0);
		const button = utils.container.querySelector(".astra-strix-band-stop") as HTMLButtonElement | null;
		if (button) {
			expect(button.disabled).toBe(true);
			fireEvent.click(button);
			await flush();
			expect(aborted).toHaveLength(0);
		}
	});
});

describe("the launch screen has a way in that does not send anything", () => {
	it("opens the workbench from the button instead of from a prompt", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();

		// 1.0.13：以前进工作台只有"发一句话"一条路，于是"看看刚才跑到哪了"也得先编一句话。
		const go = [...utils.container.querySelectorAll("button")].find((button) => button.textContent === "nav.workbench");
		expect(go).toBeTruthy();
		fireEvent.click(go as HTMLButtonElement);
		await flush();

		expect(utils.container.querySelector(".astra-strix-workbench")).not.toBeNull();
		expect(sent).toHaveLength(0);
	});
});

describe("a team chat is a read-only surface for this panel", () => {
	it("does not send into the host: the team composer owns the prompt", async () => {
		conversationState.id = "team-1";
		conversationState.sessionPath = null as unknown as string;
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();

		// 宿主在团队会话里没有给插件任何写入口：发送键换成一句说明。
		expect(utils.container.textContent).toContain("launch.teamReadOnly");
		expect([...utils.container.querySelectorAll("button")].some((button) => button.textContent === "composer.send")).toBe(false);
		expect(sent).toHaveLength(0);
	});
});
