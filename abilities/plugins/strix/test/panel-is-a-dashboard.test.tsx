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

import plugin from "../src/index";

/**
 * 面板不画对话正文（从 DOM 上验证）。
 *
 * 断言的是**同一段文字不会以正文形态出现两次**：宿主负责对话（markdown、可复制、可回滚），
 * 面板只留摘要——用户这一轮要什么、agent 说出的带信息量的一两句。
 * 同时确认面板没有因此变成空白：轮次分隔行、关键点与轨迹标题都在。
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

		// 真实答复是多句的：面板只该留带结论的那几句。
		const answer = [
			"我先看了登录页和订单接口，没有发现明显的注入。",
			"Four renditions found; one IDOR at /api/orders — an authenticated user can read another user's order by changing the id in the path.",
			"其余两个缺口需要有效凭据才能复现，我记在了笔记里，等这一轮结束后再补。",
		].join("\n\n");
		const userLine = "pentest staging.example.com, 443 only";

		await act(async () => {
			listener?.({ type: "turn-start" });
			listener?.({ type: "message-updated", delta: answer });
			listener?.({ type: "message-added", message: { id: "u1", role: "user", text: userLine } });
			listener?.({ type: "message-added", message: { id: "a1", role: "assistant", text: answer } });
		});

		// 答复的正文不在面板里（多句、带过渡语的那段搜不到）。
		expect(screen.queryByText(answer)).toBeNull();
		// 用户的诉求保留一行：读者要能记起“这一轮在干什么”，但只有一行。
		expect(screen.getByText(userLine)).toBeTruthy();
		const points = [...document.querySelectorAll(".astra-strix-say")].map((node) => node.textContent ?? "");
		expect(points.some((line) => line.includes("IDOR"))).toBe(true);
		expect(points.every((line) => line.length <= 140)).toBe(true);
		// 一行诉求 + 一行结论：不是把三个段落搬过来。
		expect(points.length).toBeLessThanOrEqual(2);
		// 但读者仍知道“这是第几轮”：分隔行在。
		expect(screen.getByText(/scan\.turnDivider/)).toBeTruthy();
		// 轨迹栏有标题，说明自己是运行记录而不是对话。
		expect(screen.getByText(/scan\.traceTitle/)).toBeTruthy();

		// 面板没有输入框：这条冗余在结构上就不存在了（发消息是宿主的事）。
		expect(document.querySelector("textarea")).toBeNull();

		if (typeof disposable === "function") await disposable();
		else await (disposable as { dispose(): void | Promise<void> }).dispose();
	});
});
