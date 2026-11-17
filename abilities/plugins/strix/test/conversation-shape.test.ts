import { describe, expect, it } from "vitest";
import { conversationShape, permitStop, shouldFollowTurn } from "../src/domain/conversation-shape";

/**
 * 形态与授权（纯函数，不渲染任何东西）。
 *
 * 1.0.16 起面板不再发消息，所以授权只剩一条：能不能停。
 * 判据是"这一轮在跑 + 这不是团队会话"——面板显示的会话就是宿主的活动会话，
 * `abort()` 打的也是它，两者同源。
 */

describe("conversationShape", () => {
	it("names a team chat by its missing session file", () => {
		expect(conversationShape({ id: "team-1", sessionPath: null })).toBe("team");
		expect(conversationShape({ id: "s1", sessionPath: "/w/a.jsonl" })).toBe("single");
	});

	it("treats an empty path as a team chat, not as a single one", () => {
		// 新会话在文件落地前可能是空串：误判成团队只会"多跟随一轮"，
		// 误判成单会话则会让面板往错的会话里写。
		expect(conversationShape({ id: "s1", sessionPath: "" })).toBe("team");
	});

	it("has no shape when the host has no conversation at all", () => {
		expect(conversationShape(null)).toBe("none");
		expect(conversationShape({ id: null, sessionPath: null })).toBe("none");
	});
});

describe("shouldFollowTurn", () => {
	it("leaves a team chat alone: it has no capsule, so the panel has not been asked for", () => {
		// 1.7.4 前这里无条件 true：结果是**每次打开任意会话**都把 Strix 拽到前面。
		expect(shouldFollowTurn("team", false)).toBe(false);
	});

	it("leaves a single-agent chat alone unless the capsule is on", () => {
		expect(shouldFollowTurn("single", false)).toBe(false);
		expect(shouldFollowTurn("single", true)).toBe(true);
	});

	it("falls back to the capsule while the shape is still unknown", () => {
		expect(shouldFollowTurn("none", false)).toBe(false);
		expect(shouldFollowTurn("none", true)).toBe(true);
	});
});

describe("permitStop", () => {
	it("lets you stop the turn that is running in the conversation you are looking at", () => {
		expect(permitStop({ shape: "single", streaming: true })).toEqual({ ok: true });
	});

	it("says nothing is running when the turn already ended", () => {
		expect(permitStop({ shape: "single", streaming: false })).toEqual({ ok: false, reason: "no-run" });
	});

	it("refuses on a team surface, where abort points at another conversation", () => {
		expect(permitStop({ shape: "team", streaming: true })).toEqual({ ok: false, reason: "team-surface" });
	});

	it("refuses when there is no conversation at all", () => {
		expect(permitStop({ shape: "none", streaming: true })).toEqual({ ok: false, reason: "not-this-conversation" });
	});
});
