// 端到端确认：面板渲染出来的 DOM 里，还有没有对话正文。
// 之前 plugin-activation 只断言了字符串；这里把真组件挂起来数 DOM。
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

/**
 * 「对话区与面板的回复一模一样」这个问题，从 DOM 上验证已经消失。
 *
 * 断言的是**同一段文字只出现在一个地方**：对话（宿主负责，这里看不到）——面板里搜不到。
 * 同时确认面板没有因此变成空白：轮次分隔行与命令块仍然在。
 */
describe("panel shows the run, not the conversation", () => {
	it("never renders the agent's answer, and still shows the turn divider", async () => {
		let listener: ((event: unknown) => void) | undefined;
		let action: { onToggle?: (active: boolean) => void } | undefined;
		let tab: { component: () => React.ReactElement } | undefined;

		const ctx = {
			plugin: { id: "strix", version: "0.7.1" },
			i18n: { t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key) },
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

		const disposable = await plugin.activate(ctx);
		action?.onToggle?.(true);
		render(tab!.component());

		const answer = "Four renditions found; one IDOR at /api/orders.";
		const userLine = "pentest staging.example.com, 443 only";

		await act(async () => {
			listener?.({ type: "turn-start" });
			listener?.({ type: "message-updated", delta: answer });
			listener?.({ type: "message-added", message: { id: "u1", role: "user", text: userLine } });
			listener?.({ type: "message-added", message: { id: "a1", role: "assistant", text: answer } });
		});

		// 面板里搜不到对话正文——这是这一轮改动的全部意义。
		expect(screen.queryByText(answer, { exact: false })).toBeNull();
		expect(screen.queryByText(userLine, { exact: false })).toBeNull();
		// 但读者仍知道“这是第几轮”：分隔行在。
		expect(screen.getByText(/scan\.turnDivider/)).toBeTruthy();
		// 轨迹栏有标题，说明自己是运行记录而不是对话。
		expect(screen.getByText(/scan\.traceTitle/)).toBeTruthy();

		// 用户在面板输入框敲的话也不再回显。
		const input = screen.getByLabelText("scan.label") as HTMLTextAreaElement;
		await act(async () => {
			fireEvent.change(input, { target: { value: "continue on /admin" } });
			fireEvent.keyDown(input, { key: "Enter" });
		});
		expect(screen.queryByText("continue on /admin", { exact: false })).toBeNull();

		if (typeof disposable === "function") await disposable();
		else await (disposable as { dispose(): void | Promise<void> }).dispose();
	});
});
