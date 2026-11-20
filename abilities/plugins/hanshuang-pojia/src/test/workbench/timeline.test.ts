import { describe, expect, it } from "vitest";
import { buildTimeline, formatDuration, mergeActivity, payloadHints } from "../../features/workbench/timeline";
import type { ActivityEntry, TaskStreamEntry } from "../../features/workbench/state";

/** 事件流由宿主按 newest-first 推来；构造器也按这个顺序返回，避免测试里再反转一次。 */
function entry(phase: TaskStreamEntry["phase"], at: string, extra: Partial<TaskStreamEntry> = {}): TaskStreamEntry {
	return {
		id: `${phase}-${extra.toolName ?? "task"}-${at}`,
		phase,
		sessionId: "s1",
		summary: "",
		at,
		...extra,
	};
}

/** 按时间正序给一串事件，再反转成 newest-first。 */
function stream(entries: TaskStreamEntry[]): TaskStreamEntry[] {
	return [...entries].reverse();
}

describe("buildTimeline", () => {
	it("pairs a tool-start with its tool-end and reports the duration", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "triage_binary" }),
				entry("tool-end", "2026-01-01T00:00:02.500Z", { toolName: "triage_binary" }),
				entry("turn-end", "2026-01-01T00:00:03.000Z"),
			]),
		);

		expect(timeline.spans).toHaveLength(1);
		expect(timeline.spans[0]).toMatchObject({ toolName: "triage_binary", status: "ok", ms: 1500, turn: 0 });
		expect(timeline.current).toMatchObject({ tools: 1, failures: 0, open: false, ms: 3000 });
	});

	it("marks a failed tool without inventing a duration when the start is missing", () => {
		const timeline = buildTimeline([entry("tool-end", "2026-01-01T00:00:05.000Z", { toolName: "run_radare", isError: true })]);

		expect(timeline.spans).toHaveLength(1);
		expect(timeline.spans[0]).toMatchObject({ status: "error", ms: null });
		expect(timeline.current.failures).toBe(1);
	});

	it("keeps a turn open when no turn-end arrived", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "scan_binary_strings" }),
			]),
		);

		expect(timeline.current).toMatchObject({ tools: 1, open: true, ms: null });
		expect(timeline.spans[0]?.status).toBe("running");
	});

	it("indexes turns from the newest, so an older call is labelled further back", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "old-tool" }),
				entry("tool-end", "2026-01-01T00:00:02.000Z", { toolName: "old-tool" }),
				entry("turn-end", "2026-01-01T00:00:03.000Z"),
				entry("turn-start", "2026-01-01T00:01:00.000Z"),
				entry("tool-start", "2026-01-01T00:01:01.000Z", { toolName: "new-tool" }),
				entry("tool-end", "2026-01-01T00:01:02.000Z", { toolName: "new-tool" }),
				entry("turn-end", "2026-01-01T00:01:03.000Z"),
			]),
		);

		// spans 也是 newest-first：最新那条 turn 为 0，上一轮是 1。
		expect(timeline.spans.map(span => [span.toolName, span.turn])).toEqual([
			["new-tool", 0],
			["old-tool", 1],
		]);
		// turns 也是 newest-first：最新的那轮 index 是 0，上一轮是 1。
		expect(timeline.turns.map(turn => turn.index)).toEqual([0, 1]);
		expect(timeline.current.tools).toBe(1);
	});

	it("returns an empty current turn when nothing happened", () => {
		const timeline = buildTimeline([]);
		expect(timeline.spans).toEqual([]);
		expect(timeline.current).toMatchObject({ tools: 0, failures: 0, open: false, ms: null });
	});
});

describe("formatDuration", () => {
	it("keeps one decimal below a second and rounds above it", () => {
		expect(formatDuration(null)).toBe("—");
		expect(formatDuration(420)).toBe("0.4s");
		expect(formatDuration(12_400)).toBe("12s");
		expect(formatDuration(65_000)).toBe("1m05s");
	});
});

describe("payloadHints", () => {
	it("keeps sizes and skips identity fields and nested objects", () => {
		const hints = payloadHints({
			sha256: "deadbeef",
			path: "/tmp/x.apk",
			format: "apk",
			entries: [1, 2, 3],
			sections: new Array(12).fill(0),
			nested: { deep: true },
			score: 92,
		});

		expect(hints).toEqual([
			{ key: "format", value: "apk" },
			{ key: "entries", value: "3" },
			{ key: "sections", value: "12" },
			{ key: "score", value: "92" },
		]);
	});

	it("caps the number of hints", () => {
		const hints = payloadHints({ a: 1, b: 2, c: 3, d: 4, e: 5 }, 2);
		expect(hints).toEqual([
			{ key: "a", value: "1" },
			{ key: "b", value: "2" },
		]);
	});

	it("returns nothing for a missing payload", () => {
		expect(payloadHints(undefined)).toEqual([]);
	});
});

describe("mergeActivity", () => {
	/** 造一条工具结果；活动流同样是 newest-first。 */
	function result(at: string, toolId: string, extra: Partial<ActivityEntry> = {}): ActivityEntry {
		return { id: `${toolId}-${at}`, toolId, kind: "other", summary: `${toolId} done`, at, ...extra };
	}

	it("folds a tool-result into the call it belongs to", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "scan_strings" }),
				entry("tool-end", "2026-01-01T00:00:02.000Z", { toolName: "scan_strings" }),
				entry("turn-end", "2026-01-01T00:00:03.000Z"),
			]),
		);
		const rows = mergeActivity(
			timeline.spans,
			[result("2026-01-01T00:00:02.100Z", "scan_strings", { payload: { entries: [1, 2] } })],
			timeline.turns,
		);

		// 一次调用只出一行：调用提供时长与状态，结果提供摘要与载荷。
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ kind: "call", toolId: "scan_strings", status: "ok", ms: 1000, summary: "scan_strings done" });
		expect(rows[0].hints).toEqual([{ key: "entries", value: "2" }]);
	});

	it("keeps a result with no matching call as its own row, without claiming success", () => {
		const rows = mergeActivity([], [result("2026-01-01T00:00:02.000Z", "run_radare")], buildTimeline([]).turns);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ kind: "result", status: null, isError: false });
	});

	it("does not pair a result that arrived long after the call finished", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "run_radare" }),
				entry("tool-end", "2026-01-01T00:00:02.000Z", { toolName: "run_radare" }),
			]),
		);
		// 60 秒之后的结果不是同一件事：宁可两行，不猜。
		const rows = mergeActivity(timeline.spans, [result("2026-01-01T00:01:02.000Z", "run_radare")], timeline.turns);

		expect(rows.map(row => row.kind).sort()).toEqual(["call", "result"]);
	});

	it("carries the failure of the call onto the merged row", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "decompile_function" }),
				entry("tool-end", "2026-01-01T00:00:02.000Z", { toolName: "decompile_function", isError: true }),
			]),
		);
		const rows = mergeActivity(timeline.spans, [], timeline.turns);

		expect(rows[0]).toMatchObject({ kind: "call", status: "error", isError: true });
	});

	it("sorts newest first and groups by the turn the call belongs to", () => {
		const timeline = buildTimeline(
			stream([
				entry("turn-start", "2026-01-01T00:00:00.000Z"),
				entry("tool-start", "2026-01-01T00:00:01.000Z", { toolName: "old-tool" }),
				entry("tool-end", "2026-01-01T00:00:02.000Z", { toolName: "old-tool" }),
				entry("turn-end", "2026-01-01T00:00:03.000Z"),
				entry("turn-start", "2026-01-01T00:01:00.000Z"),
				entry("tool-start", "2026-01-01T00:01:01.000Z", { toolName: "new-tool" }),
				entry("tool-end", "2026-01-01T00:01:02.000Z", { toolName: "new-tool" }),
			]),
		);
		const rows = mergeActivity(timeline.spans, [], timeline.turns);

		expect(rows.map(row => [row.toolId, row.turn])).toEqual([
			["new-tool", 0],
			["old-tool", 1],
		]);
	});
});
