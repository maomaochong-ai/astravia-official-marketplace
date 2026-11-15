import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 面板侧的合并刷新（1.4.1）。
 *
 * 真实场景：一轮评估里宿主会成串发 `tool-call-end`，而每一处都调 `refresh()`。
 * 优化前这里是无条件直连 `/api/state`，服务端每次 2.6s（没有缓存时）——几个并发就是几十秒，
 * 还会让状态条的 connecting 一直闪。
 *
 * 现在：在飞时只置一个标记，跑完补一次。所以 N 个事件最多产生 2 次请求。
 */

const conversationState = {
	id: "session-a",
	cwd: "D:\\work\\alpha",
	sessionPath: "D:\\work\\alpha\\.astravia\\a.jsonl",
	model: "anthropic/claude-opus-5-5",
	isStreaming: false,
};

const counters = { state: 0, conversation: 0, installPaths: 0, probe: 0 };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

vi.mock("@astravia-org/plugin-sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@astravia-org/plugin-sdk")>();
	return { ...actual, useActiveConversation: () => conversationState };
});

// 拦住网络层：只数调用次数，不碰真服务。
vi.mock("../src/domain/bridge-client", () => ({
	createBridgeClient: () => ({
		async state() {
			counters.state += 1;
			await delay(40);
			return {
				environment: { mode: "host", ready: true, detail: "", docker: { ready: false, imagePresent: null } },
				sandbox: { running: true, targets: [], mode: "host" },
				findings: [],
				notes: [],
				todos: [],
				coverage: [],
				sessions: [],
				budget: undefined,
				telemetry: null,
				history: [],
				team: null,
				scope: { entries: [], ports: [], notes: [], text: "" },
				capabilities: { tools: 40, skills: 75, skillCategories: 11, skillSource: "bundled" },
				logTail: [],
			};
		},
		async setConversation() {
			counters.conversation += 1;
			return { conversation: null };
		},
		async installPaths() {
			counters.installPaths += 1;
			return { platform: "win32", mode: "host", image: "x", container: null, entries: [] };
		},
		async findings() {
			return [];
		},
		async callTool() {
			return [];
		},
		events() {
			return () => undefined;
		},
		async probeEnvironment() {
			counters.probe += 1;
			return { mode: "host", ready: true, detail: "", docker: { ready: false, imagePresent: null }, preference: "host" };
		},
		async preferences() {
			return { environmentMode: "host" };
		},
		async setPreferences(patch: unknown) {
			return patch;
		},
		async pullImage() {
			return { ok: true };
		},
		async installDocker() {
			return { installed: true };
		},
		async stopSandbox() {
			return { stopped: true };
		},
		async report() {
			return { markdown: "", count: 0 };
		},
	}),
}));

const plugin = (await import("../src/index")).default;
const { forgetSnapshot } = await import("../src/features/scan-console/session-store");
const { setStrixEngaged } = await import("../src/domain/engagement");

afterEach(cleanup);

const realRaf = globalThis.requestAnimationFrame;
beforeEach(() => {
	forgetSnapshot(conversationState.id);
	counters.state = 0;
	counters.conversation = 0;
	counters.installPaths = 0;
	conversationState.isStreaming = false;
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
		plugin: { id: "strix", version: "1.4.1" },
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
			sendPrompt: async () => ({ status: "sent" as const }),
			insertText: () => undefined,
			abort: async () => undefined,
			createSession: async () => conversationState,
		},
		official: { shell: { showItemInFolder: async () => undefined } },
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

const settle = async (ms = 160): Promise<void> => {
	await act(async () => {
		await delay(ms);
	});
};

describe("a burst of tool calls does not become a burst of requests", () => {
	it("collapses five tool-call-end events into at most two reads", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		render(host.tab()!.component());
		await settle();

		const afterMount = counters.state;
		expect(afterMount).toBeGreaterThanOrEqual(1);

		// 五个工具调用接连落地（真实场景：并行 tool-call 的收尾）。
		await act(async () => {
			for (let index = 0; index < 5; index += 1) {
				host.emit({ type: "tool-call-end", toolCallId: `t${index}`, toolName: `strix_todo_create`, isError: false });
			}
		});
		await settle(240);

		// 在飞一次 + 排队补一次 = 最多两次新增（原来是 5 次）。
		const delta = counters.state - afterMount;
		expect(delta).toBeGreaterThanOrEqual(1);
		expect(delta).toBeLessThanOrEqual(2);
	});
});
