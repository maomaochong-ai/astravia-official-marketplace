import { describe, expect, it } from "vitest";
import { foldTrace, TRACE_LIMIT } from "../domain/trace-log";
import type { TraceEntry } from "../runtime-contract";

/**
 * 真机截图里 `preparing image` / `starting container` 各出现二十多次（容器起不来时服务
 * 反复重试）。这一层是合并规则的唯一实现，所以边界都在这里钉死。
 */

let counter = 0;
const next = (): { id: string; at: number } => ({ id: `e${(counter += 1)}`, at: counter });

const note = (label: string): TraceEntry["kind"] extends never ? never : { kind: "note"; label: string } => ({
	kind: "note",
	label,
});

describe("folding", () => {
	it("collapses a run of identical notes and counts it", () => {
		let entries: TraceEntry[] = [];
		for (let index = 0; index < 12; index += 1) {
			entries = foldTrace(entries, note("starting container"), next()).entries;
		}
		expect(entries).toHaveLength(1);
		expect(entries[0]?.count).toBe(12);
	});

	it("keeps the first id so React keys stay stable", () => {
		const first = foldTrace([], note("preparing image"), { id: "e1", at: 1 }).entries;
		const merged = foldTrace(first, note("preparing image"), { id: "e2", at: 2 }).entries;
		expect(merged[0]?.id).toBe("e1");
	});

	it("starts a new row when the text changes", () => {
		let entries = foldTrace([], note("preparing image"), next()).entries;
		entries = foldTrace(entries, note("starting container"), next()).entries;
		entries = foldTrace(entries, note("preparing image"), next()).entries;
		expect(entries.map((entry) => entry.label)).toEqual(["preparing image", "starting container", "preparing image"]);
		expect(entries.every((entry) => entry.count === undefined)).toBe(true);
	});

	it("never merges tool rows: two calls are two events", () => {
		let entries = foldTrace([], { kind: "tool", label: "strix_note_list" }, next()).entries;
		entries = foldTrace(entries, { kind: "tool", label: "strix_note_list" }, next()).entries;
		expect(entries).toHaveLength(2);
	});

	it("never merges turn dividers: each turn is information", () => {
		let entries = foldTrace([], note("turn 1 · the words are in the chat"), next()).entries;
		// 同文（同一轮的重复事件）在纯函数层会合并，但分隔行本身每轮文案不同；
		// 这里断言的是“不同轮不合并”，即文案不同。
		entries = foldTrace(entries, note("turn 2 · the words are in the chat"), next()).entries;
		expect(entries).toHaveLength(2);

		const same = foldTrace(foldTrace([], note("turn 1"), next()).entries, note("turn 1"), next()).entries;
		expect(same).toHaveLength(1);
	});

	it("drops from the head past the limit", () => {
		let entries: TraceEntry[] = [];
		for (let index = 0; index < TRACE_LIMIT + 5; index += 1) {
			entries = foldTrace(entries, { kind: "tool", label: `tool-${index}` }, next()).entries;
		}
		expect(entries).toHaveLength(TRACE_LIMIT);
		expect(entries.at(-1)?.label).toBe(`tool-${TRACE_LIMIT + 4}`);
	});

	it("reports whether it merged, so callers can skip id allocation", () => {
		const merged = foldTrace(foldTrace([], note("x"), next()).entries, note("x"), next());
		expect(merged.merged).toBe(true);
		expect(foldTrace([], note("x"), next()).merged).toBe(false);
	});
});
