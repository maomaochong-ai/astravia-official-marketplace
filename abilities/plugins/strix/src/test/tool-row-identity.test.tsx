import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { forgetSnapshot } from "../features/scan-console/session-store";

afterEach(cleanup);

// 面板会从 session-store 水合轨迹；不清掉就会把上一条测试的行带进来。
beforeEach(() => {
	forgetSnapshot("session-1");
});

/**
 * 工具行的归属：end 事件必须关掉**它自己的**那一行。
 *
 * 真机截图里出现过这样一对：
 *
 *     → Using tool strix_scope
 *     ✗ Failed
 *     → Using tool strix_scope   tud.cc 154.51.62.198
 *     ✓ Done
 *
 * 第一次调用被标 Failed，参数却落在第二条上。原因是关行时只找"最新的未关闭行"，
 * 而宿主允许并发发起 tool-call：两个工具交错时，一个的 end 会关掉另一个的行。
 * 这条测试用交错事件钉住修复后的行为。
 */

function mount() {
	let listener: ((event: unknown) => void) | undefined;
	let action: { onToggle?: (active: boolean) => void } | undefined;
	let tab: { component: () => React.ReactElement } | undefined;

	const ctx = {
		plugin: { id: "strix", version: "0.7.3" },
		i18n: { t: (key: string) => key },
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

	return { ctx, emit: (event: unknown) => listener?.(event), toggle: (v: boolean) => action?.onToggle?.(v), tab: () => tab };
}

describe("interleaved tool calls", () => {
	it("closes the row that belongs to the ending tool, not the newest one", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);
		render(host.tab()!.component());

		await act(async () => {
			host.emit({ type: "turn-start" });
			// 两个工具先后开始
			host.emit({ type: "tool-call-start", toolName: "strix_scope", args: {} });
			host.emit({ type: "tool-call-start", toolName: "strix_environment", args: {} });
			// 先结束的是**第一个**（宿主的顺序与开始顺序不必一致）
			host.emit({ type: "tool-call-end", toolName: "strix_scope", isError: true });
			host.emit({ type: "tool-call-end", toolName: "strix_environment", isError: false });
		});

		// 两行各自对应自己的工具：第一行（scope）失败、第二行（environment）成功，不串。
		// 逐工具渲染后标题是家族名，所以按顺序取行，顺序正是这条测试的被测对象。
		const rows = [...document.querySelectorAll(".astra-strix-tool")] as HTMLElement[];
		expect(rows).toHaveLength(2);
		expect(rows[0]?.getAttribute("data-state")).toBe("fail");
		expect(rows[1]?.getAttribute("data-state")).toBe("ok");
	});

	it("keeps an end event from closing another tool's row when names differ", async () => {
		const host = mount();
		await plugin.activate(host.ctx);
		host.toggle(true);
		render(host.tab()!.component());

		await act(async () => {
			host.emit({ type: "turn-start" });
			host.emit({ type: "tool-call-start", toolName: "strix_todo_create", args: { todos: [] } });
			// 一个没有对应 start 的 end：不允许把上一行的状态改掉
			host.emit({ type: "tool-call-end", toolName: "strix_unknown_tool", isError: true });
		});

		const rows = [...document.querySelectorAll(".astra-strix-tool")] as HTMLElement[];
		expect(rows).toHaveLength(1);
		expect(rows[0]?.getAttribute("data-state")).toBe("running");
	});
});
