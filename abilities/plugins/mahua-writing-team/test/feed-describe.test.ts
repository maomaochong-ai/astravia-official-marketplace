import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	describeSubagentEvent,
	describeToolEvent,
	normalizeToolName,
} from "../src/features/studio/live-feed/describe-tool-event.js";
import { feedStore } from "../src/features/studio/live-feed/feed-store.js";
import {
	FEED_FIXED_KEYS,
	STUDIO_TOOL_FEED_LABELS,
	TEAM_TOOL_FEED_LABELS,
	feedCatalogKeys,
} from "../src/features/studio/live-feed/tool-catalog.js";
import type { ToolEventFacts } from "../src/features/studio/live-feed/feed-types.js";

const AT = "2026-10-31T09:01:02.000Z";

const facts = (over: Partial<ToolEventFacts> = {}): ToolEventFacts => ({
	at: AT,
	eventName: "PostToolUse",
	toolName: "mahua_save_chapter",
	input: { bookId: "b1", chapter: 7 },
	response: { ok: true },
	...over,
});

const locale = (name: string): Record<string, string> =>
	JSON.parse(readFileSync(new URL(`../locales/${name}.json`, import.meta.url), "utf8"));

const slotsOf = (text: string): string[] => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe("feed catalog keys", () => {
	// 通用 locale 守卫只扫得到 `t("…")` 与 `%…%` 字面量。活动流的 key 是按工具名查表拼出来的，
	// 静态扫描看不见——所以这里独立对账，双向都要对：表里有的两侧都得有，两侧多出来的也必须被表引到。
	const zh = locale("zh");
	const en = locale("en");

	it("has a key for every entry in the catalog", () => {
		const missing = feedCatalogKeys().filter((key) => !(key in zh) || !(key in en));
		expect(missing).toEqual([]);
	});

	it("keeps the interpolation slots identical in both languages", () => {
		const mismatched = feedCatalogKeys().filter(
			(key) => JSON.stringify(slotsOf(zh[key] ?? "")) !== JSON.stringify(slotsOf(en[key] ?? "")),
		);
		expect(mismatched).toEqual([]);
	});

	it("never maps two tools to the same sentence", () => {
		const studio = Object.values(STUDIO_TOOL_FEED_LABELS);
		const team = Object.values(TEAM_TOOL_FEED_LABELS);
		expect(new Set(studio).size).toBe(studio.length);
		expect(new Set(team).size).toBe(team.length);
		expect(studio.filter((key) => team.includes(key))).toEqual([]);
	});

	it("carries the three status words and both subagent verbs", () => {
		for (const key of Object.values(FEED_FIXED_KEYS)) expect(key in zh && key in en, key).toBe(true);
	});
});

describe("normalizeToolName", () => {
	it("takes the last segment of a namespaced host name", () => {
		expect(normalizeToolName("mahua_save_chapter")).toBe("mahua_save_chapter");
		expect(normalizeToolName("plugin:mahua-writing-team:mahua_save_chapter")).toBe("mahua_save_chapter");
		expect(normalizeToolName("plugin/mahua/mahua_save_chapter")).toBe("mahua_save_chapter");
	});

	it("keeps a name it cannot split", () => {
		expect(normalizeToolName("team_delegate_task")).toBe("team_delegate_task");
	});
});

describe("describeToolEvent", () => {
	it("records a studio write with its chapter and status", () => {
		const draft = describeToolEvent(facts());
		expect(draft).toMatchObject({
			at: AT,
			origin: "studio",
			status: "done",
			textKey: "feed.tool.saveChapter",
			chapter: 7,
		});
		expect(draft?.textParams).toEqual({ chapter: 7 });
	});

	it("maps the three tool events to start / done / failed, and carries the error verbatim", () => {
		expect(describeToolEvent(facts({ eventName: "PreToolUse", response: null }))?.status).toBe("start");
		expect(describeToolEvent(facts())?.status).toBe("done");
		const failed = describeToolEvent(facts({ eventName: "PostToolUseFailure", error: "E_QUOTA: 额度用尽" }));
		expect(failed?.status).toBe("failed");
		// 失败原因原样透出：它是唯一能解释「为什么没成」的字段，不做转写、不做省略。
		expect(failed?.detail).toBe("E_QUOTA: 额度用尽");
	});

	it("drops read-only tools instead of flooding the feed", () => {
		for (const name of ["mahua_list_books", "mahua_read_chapter", "team_get_task", "team_list_members"]) {
			expect(describeToolEvent(facts({ toolName: name })), name).toBeNull();
		}
	});

	it("resolves the chapter from the response when the input has none", () => {
		const draft = describeToolEvent(
			facts({ toolName: "mahua_commit_chapter", input: { bookId: "b1" }, response: { chapter: 12 } }),
		);
		expect(draft?.chapter).toBe(12);
	});

	it("leaves the chapter undefined when neither side says which chapter", () => {
		const draft = describeToolEvent(facts({ toolName: "mahua_create_book", input: { title: "长夜" }, response: {} }));
		expect(draft?.chapter).toBeUndefined();
		expect(draft?.textKey).toBe("feed.tool.createBook");
	});

	it("names the real target of a delegated task", () => {
		const draft = describeToolEvent(
			facts({ toolName: "team_delegate_task", input: { requestId: "r1", target: "mahua-writer", objective: "写第 7 章" } }),
		);
		expect(draft).toMatchObject({ origin: "team", textKey: "feed.team.delegate", actor: "mahua-writer" });
		expect(draft?.textParams).toEqual({ target: "mahua-writer" });
	});

	it("does not invent a delegation without a target", () => {
		expect(describeToolEvent(facts({ toolName: "team_delegate_task", input: { requestId: "r1" } }))).toBeNull();
	});

	it("joins the recipients of a team message and previews its text", () => {
		const draft = describeToolEvent(
			facts({
				toolName: "team_send_message",
				input: { requestId: "r1", recipients: ["mahua-writer", "mahua-editor"], intent: "ask", text: "第 7 章\n  改一遍" },
			}),
		);
		expect(draft?.textParams).toEqual({ recipients: "mahua-writer, mahua-editor", text: "第 7 章 改一遍" });
	});

	it("trims a long message preview instead of pasting the whole instruction", () => {
		const long = "改".repeat(120);
		const draft = describeToolEvent(
			facts({ toolName: "team_send_message", input: { requestId: "r1", recipients: ["mahua-editor"], text: long } }),
		);
		const text = (draft?.textParams as { text: string }).text;
		expect(text.length).toBe(81);
		expect(text.endsWith("…")).toBe(true);
	});

	it("counts the tasks a wait is blocking on", () => {
		const draft = describeToolEvent(facts({ toolName: "team_wait_tasks", input: { teamTaskIds: ["a", "b"] } }));
		expect(draft?.textParams).toEqual({ count: 2 });
	});

	it("keys the remaining team verbs on the task id, and skips the ones without one", () => {
		for (const name of ["team_continue_task", "team_retry_task", "team_cancel_task"]) {
			const draft = describeToolEvent(facts({ toolName: name, input: { teamTaskId: "t9" } }));
			expect(draft?.textParams, name).toEqual({ taskId: "t9" });
			expect(describeToolEvent(facts({ toolName: name, input: {} })), name).toBeNull();
		}
	});
});

describe("describeSubagentEvent", () => {
	it("records a subagent start with its type", () => {
		expect(describeSubagentEvent("start", "Explore", AT)).toMatchObject({
			origin: "agent",
			status: "start",
			textKey: "feed.agent.start",
			actor: "Explore",
			textParams: { agentType: "Explore" },
		});
	});

	it("keeps the last message of a finished subagent as the detail", () => {
		const draft = describeSubagentEvent("stop", "Explore", AT, "找到三处伏笔冲突");
		expect(draft).toMatchObject({ status: "done", textKey: "feed.agent.stop", detail: "找到三处伏笔冲突" });
		expect(describeSubagentEvent("stop", "Explore", AT)?.detail).toBeUndefined();
	});
});

describe("feedStore", () => {
	it("appends newest-first-bounded and notifies subscribers only on change", () => {
		let notifications = 0;
		const unsubscribe = feedStore.subscribe(() => {
			notifications += 1;
		});
		const before = feedStore.getSnapshot();

		feedStore.append({ at: AT, origin: "studio", status: "done", textKey: "feed.tool.saveChapter" });
		expect(notifications).toBe(1);
		expect(feedStore.getSnapshot()).not.toBe(before);
		expect(feedStore.getSnapshot()[0].textKey).toBe("feed.tool.saveChapter");
		expect(feedStore.getSnapshot()[0].id).toBeTruthy();

		unsubscribe();
		feedStore.append({ at: AT, origin: "studio", status: "done", textKey: "feed.tool.commitChapter" });
		expect(notifications).toBe(1);
		feedStore.clear();
	});

	it("hydrates only into an empty store, so live events are never pushed below history", () => {
		feedStore.clear();
		feedStore.append({ at: AT, origin: "studio", status: "start", textKey: "feed.tool.startDrafting" });
		feedStore.hydrate([{ id: "old", at: AT, origin: "studio", status: "done", textKey: "feed.tool.saveReview" }]);
		expect(feedStore.getSnapshot().map((event) => event.id === "old")).toEqual([false]);
		feedStore.clear();
		feedStore.hydrate([{ id: "old", at: AT, origin: "studio", status: "done", textKey: "feed.tool.saveReview" }]);
		expect(feedStore.getSnapshot().map((event) => event.id)).toEqual(["old"]);
		feedStore.clear();
	});

	it("keeps the ring bounded instead of growing for the whole session", () => {
		feedStore.clear();
		for (let index = 0; index < 260; index += 1) {
			feedStore.append({ at: AT, origin: "studio", status: "done", textKey: "feed.tool.saveChapter", textParams: { index } });
		}
		const events = feedStore.getSnapshot();
		expect(events.length).toBe(200);
		// 最新的在最前：丢的是老的那一头。
		expect((events[0].textParams as { index: number }).index).toBe(259);
		feedStore.clear();
	});
});

describe("live-feed hook registration", () => {
	const source = readFileSync(new URL("../src/live-feed-hooks.ts", import.meta.url), "utf8");

	it("declares scope_use on every hook, because the host fails closed", () => {
		const registrations = source.match(/registerHook\(/g) ?? [];
		const scopes = source.match(/scope_use: \[\.\.\.SCENARIOS\]/g) ?? [];
		expect(registrations.length).toBeGreaterThan(0);
		expect(scopes.length).toBe(registrations.length);
	});

	it("uses unique hook ids", () => {
		const ids = [...source.matchAll(/id: "(mahua-[a-z-]+)"/g)].map((match) => match[1]);
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("leaves toolNames open instead of pinning a guessed host name", () => {
		// 猜错 hostName 的后果是 hook 静默永不触发，而不是多跑几次；过滤放到 describeToolEvent 里。
		expect(source).not.toMatch(/toolNames:/);
	});
});
