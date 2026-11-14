import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 「在宿主对话框发送之后，插件没有自动跳到工作面板」——两件事合成的一个症状：
 *
 *  1. **面板不被带到前面**：胶囊开着、这一轮跑起来了，但活动栏仍停在上一个标签页
 *     （宿主把 docked 面板的子树整体卸载，插件连等都没地方等）。用户翻回插件标签，
 *     看到的是首屏——也就是"没跳"。
 *  2. **重挂载落在首屏**：面板在轮次进行中被重新挂载时，phase 从快照来；快照里还是
 *     `setup`（第一轮还没有任何 finding/todo 可查），于是又画成首屏。
 *
 * 这里钉住可观察的两条：轮次一开始就要把面板带到前面；宿主正在跑的时候挂载，
 * 落地就应该是工作台。
 */

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
import { setStrixEngaged } from "../domain/engagement";
import { forgetSnapshot } from "../features/scan-console/session-store";

afterEach(cleanup);

const realRaf = globalThis.requestAnimationFrame;
beforeEach(() => {
	// 快照是模块级的（keyed by conversation id）：不清理的话上一个用例的 phase 会漏进来，
	// 断言就变成在测自己。
	forgetSnapshot(conversationState.id);
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		callback(0);
		return 0;
	}) as typeof requestAnimationFrame;
	conversationState.isStreaming = false;
	setStrixEngaged(false);
});
afterEach(() => {
	globalThis.requestAnimationFrame = realRaf;
});

function mount() {
	let action: { onToggle?: (active: boolean) => void } | undefined;
	// 宿主把监听器放在一个数组里（plugin-host-bridge 的 `listeners`）：激活时订阅一次、
	// 面板挂载再订阅一次。harness 只存一个会让前一个静默失效，测出来的就不是真实行为。
	const listeners: Array<(event: unknown) => void> = [];
	let tab: { component: () => React.ReactElement } | undefined;
	const calls: string[] = [];

	const ctx = {
		plugin: { id: "strix", version: "1.0.5" },
		i18n: { t: (key: string, params?: Record<string, string | number>) => (params ? `${key} ${JSON.stringify(params)}` : key) },
		ui: {
			registerActivityTab: (contribution: { component: () => React.ReactElement }) => {
				tab = contribution;
				return { dispose() {} };
			},
			registerInputAction: (contribution: { onToggle?: (active: boolean) => void }) => {
				action = contribution;
				return { dispose() {} };
			},
			registerShortcutScope: () => ({ dispose() {} }),
			setActivityTabVisible: () => calls.push("visible"),
			openActivityTab: () => calls.push("open"),
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
			sendPrompt: async () => ({ status: "sent" }),
			insertText: () => undefined,
			abort: async () => undefined,
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
		calls,
		emit: (event: unknown) => listeners.forEach((next) => next(event)),
		toggle: (value: boolean) => action?.onToggle?.(value),
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

const hasLaunchColumn = (container: HTMLElement): boolean => container.querySelector(".astra-strix-launch") !== null;
const hasWorkbench = (container: HTMLElement): boolean => container.querySelector(".astra-strix-workbench") !== null;

describe("a host turn brings the panel to the front", () => {
	it("brings the tab to the front when the capsule is on", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.calls.length = 0;
		host.toggle(true);
		render(host.tab()!.component());
		await flush();

		host.calls.length = 0;
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		// 胶囊开着 = 「这一轮交给我」：用户期待的落地是看到现场。
		expect(host.calls).toContain("open");
	});

	it("stays put when the capsule is off", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);
		render(host.tab()!.component());
		await flush();

		// 用户把胶囊关掉：这一轮不是插件的活，抢焦点就是骚扰。
		host.toggle(false);
		host.calls.length = 0;
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		expect(host.calls).not.toContain("open");
	});

	it("leaves the launch screen on that same turn, capsule or not", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);
		host.toggle(false);
		const utils = render(host.tab()!.component());
		await flush();
		expect(hasLaunchColumn(utils.container)).toBe(true);

		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();

		// 状态跟会话走（1.0.5）；"抢焦点"才需要胶囊（1.0.6）。
		expect(hasLaunchColumn(utils.container)).toBe(false);
	});
});

describe("mounting mid-turn lands on the workbench", () => {
	it("does not paint the launch screen while the host is running", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);

		// 面板被宿主重新挂载，而这一轮正在跑：首屏是给"还没开始"的，不是给"正在跑"的。
		conversationState.isStreaming = true;
		const utils = render(host.tab()!.component());
		await flush();

		expect(hasLaunchColumn(utils.container)).toBe(false);
		expect(hasWorkbench(utils.container) || utils.container.querySelector(".astra-strix-transcript") !== null).toBe(true);
	});
});
