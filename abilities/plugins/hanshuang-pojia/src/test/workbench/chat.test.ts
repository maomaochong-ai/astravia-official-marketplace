import { describe, expect, it, vi } from "vitest";
import type { PluginConversationApi, SendPromptResult } from "@astravia-org/plugin-sdk";
import { deliverPrompt, looksLikeNoSession } from "../../features/workbench/services/chat";

interface FakeOptions {
	send?: Array<SendPromptResult | Error>;
	createFails?: boolean;
	create?: () => Promise<unknown>;
}

function fakeConversation(options: FakeOptions = {}) {
	const queue = [...(options.send ?? [{ status: "sent" as const }])];
	const sendPrompt = vi.fn(async () => {
		const next = queue.shift() ?? { status: "sent" as const };
		if (next instanceof Error) throw next;
		return next;
	});
	const createSession = vi.fn(async (_cwd: string, _options?: { navigate?: boolean }) => {
		if (options.createFails) throw new Error("createSession rejected");
		return { id: "session-2", cwd: "/work", sessionPath: null, model: null, isStreaming: false };
	});
	const api = { sendPrompt, createSession } as unknown as PluginConversationApi;
	return { api, sendPrompt, createSession };
}

describe("looksLikeNoSession", () => {
	it("recognises the host's wording for a missing session", () => {
		expect(looksLikeNoSession(new Error("There is no active conversation"))).toBe(true);
		expect(looksLikeNoSession(new Error("no open conversation"))).toBe(true);
		expect(looksLikeNoSession(new Error("当前没有可用的对话"))).toBe(true);
	});

	it("leaves unrelated failures alone so a live session is never replaced", () => {
		expect(looksLikeNoSession(new Error("permission denied: agent.session.write"))).toBe(false);
		expect(looksLikeNoSession(new Error("model overloaded"))).toBe(false);
	});
});

describe("deliverPrompt", () => {
	it("sends straight into the active conversation", async () => {
		const { api, sendPrompt, createSession } = fakeConversation();
		await expect(deliverPrompt(api, "check the toolchain", "/work", "session-1")).resolves.toBe("sent");
		expect(sendPrompt).toHaveBeenCalledTimes(1);
		expect(createSession).not.toHaveBeenCalled();
	});

	it("reports a queued prompt instead of pretending it was sent", async () => {
		const { api } = fakeConversation({ send: [{ status: "queued", queueItemId: "q1" }] });
		await expect(deliverPrompt(api, "hi", "/work", "session-1")).resolves.toBe("queued");
	});

	it("opens a session without probing when the host already reported none", async () => {
		const { api, sendPrompt, createSession } = fakeConversation();
		await expect(deliverPrompt(api, "hi", "/work", null)).resolves.toBe("opened");
		// 直接新建：createSession 先于 sendPrompt，且没有先吃一次必然失败的发送。
		expect(createSession).toHaveBeenCalledWith("/work");
		expect(sendPrompt).toHaveBeenCalledTimes(1);
	});

	it("falls back to a new session when the state was unknown and sending reported none", async () => {
		const { api, createSession } = fakeConversation({
			send: [new Error("No active conversation"), { status: "sent" }],
		});
		await expect(deliverPrompt(api, "hi", "/work", undefined)).resolves.toBe("opened");
		expect(createSession).toHaveBeenCalledTimes(1);
	});

	it("does not swallow failures that are not about a missing session", async () => {
		const { api, createSession } = fakeConversation({ send: [new Error("permission denied: agent.session.write")] });
		await expect(deliverPrompt(api, "hi", "/work", undefined)).rejects.toThrow(/permission denied/);
		expect(createSession).not.toHaveBeenCalled();
	});

	it("surfaces a failed send inside a live session", async () => {
		const { api } = fakeConversation({ send: [{ status: "failed", error: { message: "model unreachable" } }] });
		await expect(deliverPrompt(api, "hi", "/work", "session-1")).rejects.toThrow(/model unreachable/);
	});

	it("refuses to guess a workspace when the panel has no cwd", async () => {
		const { api, sendPrompt } = fakeConversation();
		await expect(deliverPrompt(api, "hi", null, "session-1")).rejects.toThrow(/no workspace folder/);
		expect(sendPrompt).not.toHaveBeenCalled();
	});
});
