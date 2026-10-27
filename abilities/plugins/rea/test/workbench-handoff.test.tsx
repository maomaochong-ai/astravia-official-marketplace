// @vitest-environment jsdom

/**
 * 交接流程的诚实性。
 *
 * 用户反馈的现场是：点了「交给 Agent」，状态显示「已发送到对话」，宿主对话区却
 * 什么都没有。根因是宿主把内部提前 return 兜底成 `{ status: "sent" }`，插件这边
 * 光看回执分不出真假。所以这几条用例锁的是**插件自己的判断**：
 *
 *   1. 没有活跃会话 → 先建会话，不把消息发进虚空；
 *   2. 建不出来 → 如实报「没有活跃对话」，而不是假装发出；
 *   3. 回了 sent 但对话里等不到 → 「未确认」，不是「已发送」；
 *   4. 通道抛错 → 退回「仅填入」。
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@astravia-org/plugin-sdk", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import { useWorkbench, type WorkbenchDeps } from "../src/features/rea-workflow/hooks/use-workbench";

function makeDeps(overrides: Partial<WorkbenchDeps> = {}): WorkbenchDeps {
	return {
		sendPrompt: async () => ({ status: "sent" }) as never,
		insertPrompt: () => true,
		cwd: "/tmp/case",
		conversationId: "session-1",
		ensureSession: null,
		watchDelivery: async () => "confirmed",
		detected: null,
		detectedPath: null,
		hinted: null,
		hintedPath: null,
		onRoute: () => {},
		...overrides,
	};
}

/** 把 handoffToAgent 内部的 await 链跑干净（宏任务 + 微任务都推进一轮）。 */
async function flush(): Promise<void> {
	for (let i = 0; i < 4; i += 1) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
}

async function runHandoff(deps: WorkbenchDeps): Promise<ReturnType<typeof useWorkbench>> {
	const { result } = renderHook(() => useWorkbench(deps));
	act(() => {
		result.current.setTarget("/tmp/case/app.apk");
		result.current.pick("mobile");
	});
	act(() => {
		result.current.handoffToAgent();
	});
	await flush();
	return result.current;
}

describe("交给 Agent 的送达判定", () => {
	it("看见消息上屏才算已发送", async () => {
		const watchDelivery = vi.fn(async () => "confirmed" as const);
		const state = await runHandoff(makeDeps({ watchDelivery }));
		expect(state.handoff).toBe("sent");
		expect(watchDelivery).toHaveBeenCalledTimes(1);
	});

	it("回了 sent 但对话里等不到 → 未确认", async () => {
		const state = await runHandoff(makeDeps({ watchDelivery: async () => "timeout" as const }));
		expect(state.handoff).toBe("unverified");
	});

	it("turn-start 也算送达：Agent 已经开始跑这一轮", async () => {
		const state = await runHandoff(makeDeps({ watchDelivery: async () => "turnStarted" as const }));
		expect(state.handoff).toBe("sent");
	});

	it("没有活跃会话时先建会话，再发", async () => {
		const order: string[] = [];
		const state = await runHandoff(
			makeDeps({
				conversationId: null,
				ensureSession: async () => {
					order.push("create");
					return "session-2";
				},
				sendPrompt: async () => {
					order.push("send");
					return { status: "sent" } as never;
				},
			}),
		);
		expect(order).toEqual(["create", "send"]);
		expect(state.handoff).toBe("sent");
	});

	it("建不出会话就如实报无处可发，不调用 sendPrompt", async () => {
		const sendPrompt = vi.fn(async () => ({ status: "sent" }) as never);
		const state = await runHandoff(
			makeDeps({
				conversationId: null,
				ensureSession: async () => null,
				sendPrompt,
			}),
		);
		expect(sendPrompt).not.toHaveBeenCalled();
		expect(state.handoff).toBe("noConversation");
		// 任务文本已留存，用户还能复制或自己发。
		expect(state.promptText.length).toBeGreaterThan(0);
	});

	it("排队中不当成已发送", async () => {
		const watchDelivery = vi.fn(async () => "confirmed" as const);
		const state = await runHandoff(
			makeDeps({ sendPrompt: async () => ({ status: "queued", queueItemId: "q1" }) as never, watchDelivery }),
		);
		expect(state.handoff).toBe("queued");
		expect(watchDelivery).not.toHaveBeenCalled();
	});

	it("发送通道抛错 → 退回仅填入", async () => {
		const insertPrompt = vi.fn(() => true);
		const state = await runHandoff(
			makeDeps({
				sendPrompt: async () => {
					throw new Error("agent.session.write denied");
				},
				insertPrompt,
			}),
		);
		expect(insertPrompt).toHaveBeenCalledTimes(1);
		expect(state.handoff).toBe("inserted");
	});
});
