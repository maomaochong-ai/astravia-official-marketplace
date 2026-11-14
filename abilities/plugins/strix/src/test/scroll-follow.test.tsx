import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextFollow } from "../features/scan-console/scroll-stick";

const conversationState = {
	id: "session-1",
	cwd: "D:\\open-source-projects\\strix",
	sessionPath: null,
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

vi.mock("@astravia-org/plugin-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@astravia-org/plugin-sdk")>();
	return { ...actual, useActiveConversation: () => conversationState };
});

import plugin from "../index";

afterEach(cleanup);

/**
 * 「流式输出时内容往上跑，永远看到开头」——必现 bug。
 *
 * 旧实现从滚动几何反推是否跟随：内容长高时浏览器先发 scroll，此刻 scrollTop 没动、
 * scrollHeight 已变大 → 几何上是「不在底部」→ 跟随被自己关掉，之后永远停在顶部。
 *
 * 这里钉三件事：手势是唯一取消源、跟随态下持续贴底、读者上滚后不抢滚动并给出计数。
 */

function mount() {
	let listener: ((event: unknown) => void) | undefined;
	let action: { onToggle?: (active: boolean) => void } | undefined;
	let tab: { component: () => React.ReactElement } | undefined;

	const ctx = {
		plugin: { id: "strix", version: "0.7.4" },
		i18n: {
			t: (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		},
		ui: {
			registerActivityTab: (contribution: { component: () => React.ReactElement }) => {
				tab = contribution;
				return { dispose() {} };
			},
			registerInputAction: (contribution: { onToggle?: (active: boolean) => void }) => {
				action = contribution;
				return { dispose() {} };
			},
			setActivityTabVisible: () => undefined,
			openActivityTab: () => undefined,
		},
		conversation: {
			on: (next: (event: unknown) => void) => {
				listener = next;
				return { dispose() {} };
			},
			sendPrompt: async () => ({ status: "sent" }),
			insertText: () => undefined,
			abort: async () => undefined,
			createSession: async () => conversationState,
		},
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
		emit: (event: unknown) => listener?.(event),
		toggle: (value: boolean) => action?.onToggle?.(value),
		tab: () => tab,
	};
}

interface Growable {
	__grow: (by: number) => void;
}

/** jsdom 没有布局：给容器装上可写的几何，模拟「内容比视口高」。 */
function fakeLayout(element: HTMLElement, initial: { scrollHeight: number; clientHeight: number }): void {
	let scrollHeight = initial.scrollHeight;
	const clientHeight = initial.clientHeight;
	let scrollTop = 0;
	Object.defineProperty(element, "scrollHeight", { configurable: true, get: () => scrollHeight });
	Object.defineProperty(element, "clientHeight", { configurable: true, get: () => clientHeight });
	Object.defineProperty(element, "scrollTop", {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		},
	});
	(element as unknown as Growable).__grow = (by: number) => {
		scrollHeight += by;
	};
}

const flush = async (): Promise<void> => {
	for (let index = 0; index < 2; index += 1) {
		await act(async () => {
			await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		});
	}
};

/** 面板只有进入扫描态才有轨迹栏：先点胶囊、再发 turn-start。 */
async function openScanScreen() {
	const host = mount();
	await plugin.activate(host.ctx);
	host.toggle(true);
	const utils = render(host.tab()!.component());
	await act(async () => {
		host.emit({ type: "turn-start" });
	});
	await flush();
	const body = utils.container.querySelector(".astra-strix-transcript-body") as HTMLElement | null;
	return { host, container: utils.container, body };
}

describe("follow decision", () => {
	it("only a gesture cancels following", () => {
		expect(nextFollow(true, "wheel-up", true)).toBe(false);
		expect(nextFollow(true, "touch", false)).toBe(false);
		expect(nextFollow(true, "key-up", true)).toBe(false);
		// 内容自己长高不是手势：不能用几何把它关掉。
		expect(nextFollow(true, "wheel-down", false)).toBe(true);
		expect(nextFollow(true, "jump-to-end", false)).toBe(true);
	});
});

describe("run log follows the newest row", () => {
	it("reaches the scan screen and renders the run log", async () => {
		const { body } = await openScanScreen();
		expect(body).toBeTruthy();
	});

	it("stays at the bottom while rows keep arriving", async () => {
		const { host, body } = await openScanScreen();
		if (!body) throw new Error("no transcript");
		fakeLayout(body, { scrollHeight: 600, clientHeight: 400 });

		for (let index = 0; index < 20; index += 1) {
			(body as unknown as Growable).__grow(120);
			await act(async () => {
				host.emit({ type: "tool-call-start", toolName: "strix_note_list", args: {} });
			});
			await flush();
		}

		expect(body.scrollTop).toBe(body.scrollHeight - body.clientHeight);
		// 读者没离开底部，就不该有“未读”提示。
		expect(screen.queryByText(/scan\.newRows/)).toBeNull();
	});

	it("stops following after the reader scrolls up, and offers a jump back", async () => {
		const { host, body } = await openScanScreen();
		if (!body) throw new Error("no transcript");
		fakeLayout(body, { scrollHeight: 600, clientHeight: 400 });
		await flush();

		// 读者往上滚：先离开底部，再发出真实的 wheel 手势。
		body.scrollTop = 0;
		await act(async () => {
			body.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true }));
		});
		await flush();

		const parked = body.scrollTop;
		(body as unknown as Growable).__grow(400);
		await act(async () => {
			host.emit({ type: "tool-call-start", toolName: "strix_note_list", args: {} });
		});
		await flush();

		expect(body.scrollTop).toBe(parked);
		expect(await screen.findByText(/scan\.newRows/)).toBeTruthy();
	});
});
