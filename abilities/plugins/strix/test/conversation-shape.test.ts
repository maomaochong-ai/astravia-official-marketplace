import { describe, expect, it } from "vitest";
import { conversationShape, permitHostAction, shouldFollowTurn } from "../src/domain/conversation-shape";

/**
 * 形态与授权（ADR 0020）。纯函数，不渲染任何东西：
 * 这三条判断是面板全部写动作的入口，错了就是跨会话事故。
 */

describe("conversationShape", () => {
	it("names a team chat by its missing session file", () => {
		// 宿主在 override 那一支写死 `sessionPath: null`，这是唯一的形态信号。
		expect(conversationShape({ id: "team-1", sessionPath: null })).toBe("team");
		expect(conversationShape({ id: "s1", sessionPath: "/w/a.jsonl" })).toBe("single");
	});

	it("treats an empty path as a team chat, not as a single one", () => {
		// 新会话在文件落地前可能是空串。误判成团队只会"多跟随一轮"；
		// 误判成单会话则会让面板往错的会话里写——两害相权取前者。
		expect(conversationShape({ id: "s1", sessionPath: "" })).toBe("team");
	});

	it("has no shape when the host has no conversation at all", () => {
		expect(conversationShape(null)).toBe("none");
		expect(conversationShape({ id: null, sessionPath: null })).toBe("none");
	});
});

describe("shouldFollowTurn", () => {
	it("follows a team chat even though there is no capsule to switch on", () => {
		// 团队 composer 上没有插件的输入栏动作，engaged 在那边恒为 false。
		// 缺席不是拒绝：这一轮必须把面板带出来。
		expect(shouldFollowTurn("team", false)).toBe(true);
	});

	it("leaves a single-agent chat alone unless the capsule is on", () => {
		expect(shouldFollowTurn("single", false)).toBe(false);
		expect(shouldFollowTurn("single", true)).toBe(true);
	});

	it("falls back to the capsule while the shape is still unknown", () => {
		// 还没收到 conversation-changed 时不能假装是团队会话。
		expect(shouldFollowTurn("none", false)).toBe(false);
		expect(shouldFollowTurn("none", true)).toBe(true);
	});
});

describe("permitHostAction", () => {
	it("refuses every write on a team surface", () => {
		for (const action of ["send", "stop"] as const) {
			expect(permitHostAction({ shape: "team", action, runOwner: "team-1", boundTo: "team-1" })).toEqual({
				ok: false,
				reason: "team-surface",
			});
		}
	});

	it("lets a single chat send, because a user asking the panel to start is the permission", () => {
		expect(permitHostAction({ shape: "single", action: "send", runOwner: null, boundTo: "s1" })).toEqual({ ok: true });
	});

	it("stops only what this panel started, in the conversation it started it in", () => {
		expect(permitHostAction({ shape: "single", action: "stop", runOwner: null, boundTo: "s1" })).toEqual({
			ok: false,
			reason: "no-run",
		});
		// A 里发起的运行，面板现在停在 B：abort 会打到 B，必须拦下。
		expect(permitHostAction({ shape: "single", action: "stop", runOwner: "session-a", boundTo: "session-b" })).toEqual({
			ok: false,
			reason: "not-this-conversation",
		});
		expect(permitHostAction({ shape: "single", action: "stop", runOwner: "session-a", boundTo: "session-a" })).toEqual({
			ok: true,
		});
	});
});
