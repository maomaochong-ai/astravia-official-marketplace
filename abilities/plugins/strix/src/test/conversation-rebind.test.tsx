import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 「在 A 会话启用插件，切到 B 会话，面板还在画 A 的东西」——串会话。
 *
 * 宿主按 `workspaceId + tabId` 给面板做 key（ActivityTabSurface），**切换会话不重挂载**。
 * 面板里 `mountedIn` 只认挂载那一刻的 id，于是 B 会话的事件全被 `belongsTo` 挡掉，
 * 屏幕上留着的就是 A 的沙箱、A 的命令、A 的发现——看起来像"数据串了"，其实是没重绑。
 *
 * 这里钉两件事：
 *  1. conversation.id 一变，面板立刻重绑到新会话（读新会话的快照，不读旧的）。
 *  2. 重绑之后，新会话的轮次能被接收（belongsTo 面向新 id 成立）。
 */

const state = {
	id: "conv-a" as string | null,
	cwd: "D:\\proj-a",
	sessionPath: null as string | null,
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

vi.mock("@astravia-org/plugin-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@astravia-org/plugin-sdk")>();
	return { ...actual, useActiveConversation: () => state };
});

import plugin from "../index";
import { writeSnapshot } from "../features/scan-console/session-store";
import { setStrixEngaged } from "../domain/engagement";

afterEach(cleanup);

const realRaf = globalThis.requestAnimationFrame;
beforeEach(() => {
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
		callback(0);
		return 0;
	}) as typeof requestAnimationFrame;
	state.id = "conv-a";
	state.cwd = "D:\\proj-a";
	state.isStreaming = false;
	setStrixEngaged(false);
});
afterEach(() => {
	globalThis.requestAnimationFrame = realRaf;
});

function mount() {
	let action: { onToggle?: (active: boolean) => void } | undefined;
	let tab: { component: () => React.ReactElement } | undefined;
	const listeners: Array<(event: unknown) => void> = [];

	const ctx = {
		plugin: { id: "strix", version: "1.0.7" },
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
			sendPrompt: async () => ({ status: "sent" }),
			insertText: () => undefined,
			abort: async () => undefined,
			createSession: async () => state,
		},
		fileExplorer: { getWorkspaceRoots: () => [{ path: state.cwd }] },
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
		toggle: (value: boolean) => action?.onToggle?.(value),
		tab: () => tab,
	};
}

const flush = async (): Promise<void> => {
	for (let index = 0; index < 3; index += 1) {
		await act(async () => {
			await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		});
	}
};

describe("switching conversation rebinds the panel", () => {
	it("shows the new conversation's snapshot, not the old one's rows", async () => {
		// A 会话留下一条明显属于它的证据。
		writeSnapshot("conv-a", {
			phase: "scanning",
			trace: [{ id: "e1", kind: "note", label: "A-CONVERSATION-ROW", at: 0 }],
			targets: ["https://a.example"],
			sandbox: { running: true, targets: [] },
			findings: [],
			todos: [],
			notes: [],
			coverage: [],
			mcp: [],
		});
		// B 会话是干净的。
		writeSnapshot("conv-b", {
			phase: "setup",
			trace: [],
			targets: [],
			sandbox: { running: false, targets: [] },
			findings: [],
			todos: [],
			notes: [],
			coverage: [],
			mcp: [],
		});

		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);
		const utils = render(host.tab()!.component());
		await flush();
		expect(utils.container.textContent).toContain("A-CONVERSATION-ROW");

		// 用户切到 B 会话：同一个面板（宿主不重挂载）。
		state.id = "conv-b";
		state.cwd = "D:\\proj-b";
		utils.rerender(host.tab()!.component());
		await flush();

		expect(utils.container.textContent).not.toContain("A-CONVERSATION-ROW");
	});

	it("accepts the new conversation's turns after rebinding", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);
		const utils = render(host.tab()!.component());
		await flush();

		state.id = "conv-b";
		state.cwd = "D:\\proj-b";
		utils.rerender(host.tab()!.component());
		await flush();

		// 轮次分隔行真的被画出来 == 这一轮被收下了。旧实现里 mountedIn 停在 conv-a，
		// belongsTo 把 conv-b 的事件全挡掉，所以这条在重绑之前是红的。
		await act(async () => {
			host.emit({ type: "turn-start" });
		});
		await flush();
		expect(utils.container.textContent).toContain("scan.turnDivider");
	});
});
