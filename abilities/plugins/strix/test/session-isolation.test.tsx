import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 停止键的边界（1.0.16）。
 *
 * 1.0.13 修过一次跨会话误伤：在 A 跑评估、到 B 点停止，B 的普通对话被终止。当时的判据是
 * "这一轮是本面板发起的"。现在面板不发消息了（没有输入框），那个判据会把键永远按灰，
 * 所以判据换成"这一轮在跑 + 这不是团队会话"：
 *
 *  - 面板显示的会话 = 宿主的活动会话（同一个快照），`abort()` 打的也是它；
 *  - 团队会话里 `abort()` 指向的是上一个单会话，所以要拒绝。
 */

const conversationState = {
	id: "session-a",
	cwd: "D:\\open-source-projects\\alpha",
	sessionPath: "D:\\open-source-projects\\alpha\\.astravia\\a.jsonl",
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

const aborted: string[] = [];

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
	for (const id of ["session-a", "session-b", "team-1"]) forgetSnapshot(id);
	conversationState.id = "session-a";
	conversationState.sessionPath = "D:\\open-source-projects\\alpha\\.astravia\\a.jsonl";
	conversationState.isStreaming = false;
	aborted.length = 0;
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
		plugin: { id: "strix", version: "1.0.16" },
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

function stopButton(container: HTMLElement): HTMLButtonElement | null {
	return container.querySelector(".astra-strix-band-stop") as HTMLButtonElement | null;
}

describe("stop belongs to the conversation on screen", () => {
	it("is live while this conversation is generating", async () => {
		conversationState.isStreaming = true;
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		const button = stopButton(utils.container);
		expect(button, "the workbench should show a stop control").toBeTruthy();
		expect(button!.disabled).toBe(false);
	});

	it("goes grey when the turn has ended", async () => {
		conversationState.isStreaming = true;
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();
		expect(stopButton(utils.container)?.disabled).toBe(false);

		conversationState.isStreaming = false;
		await act(async () => {
			host.emit({ type: "turn-end", stopReason: "end" });
		});
		await flush();

		expect(stopButton(utils.container)?.disabled).toBe(true);
		fireEvent.click(stopButton(utils.container)!);
		await flush();
		expect(aborted).toHaveLength(0);
	});

	it("is never offered in a team chat, where abort points elsewhere", async () => {
		conversationState.id = "team-1";
		conversationState.sessionPath = null as unknown as string;
		conversationState.isStreaming = true;
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		const button = stopButton(utils.container);
		expect(button?.disabled).toBe(true);
		if (button) {
			fireEvent.click(button);
			await flush();
		}
		expect(aborted).toHaveLength(0);
	});
});

describe("the panel has no composer", () => {
	it("offers no textarea and no send button on either screen", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		const utils = render(host.tab()!.component());
		await flush();

		// 首屏：配置页。
		expect(utils.container.querySelector("textarea")).toBeNull();
		expect([...utils.container.querySelectorAll("button")].some((button) => button.textContent === "composer.send")).toBe(false);

		// 工作台：也是只读现场。
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();
		expect(utils.container.querySelector(".astra-strix-workbench")).not.toBeNull();
		expect(utils.container.querySelector("textarea")).toBeNull();
	});
});
