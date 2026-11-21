import { describe, expect, it } from "vitest";
import { buildTimeline, mergeActivity } from "../../features/workbench/timeline";
import type { ActivityEntry, TaskStreamEntry } from "../../features/workbench/state";

/**
 * 渲染预算（烟雾门禁，不是基准测试）。
 *
 * 目的只有一个：挡住「把 O(n) 的派生计算放回渲染路径」这类回退。
 * 阈值故意留了很大余量 —— 这套用例会和另外 88 个文件并行跑，实测同一函数
 * 单独跑 0.6ms、满载时 2ms。卡死线只会变成噪声（第一版就因此误红过一次）。
 *
 * 真实数字在这里量过并写进 ADR 0019：buildTimeline 0.0755ms、
 * mergeActivity 0.9783ms（80 事件 + 200 结果）。
 */

const TASKS = 80;
const ACTIVITY = 200;

function events(): TaskStreamEntry[] {
	const phases: TaskStreamEntry["phase"][] = ["turn-start", "tool-start", "tool-end"];
	return Array.from({ length: TASKS }, (_, index) => ({
		id: `e${index}`,
		phase: phases[index % 3]!,
		sessionId: "s1",
		toolName: `tool_${index % 35}`,
		summary: "x".repeat(40),
		at: new Date(Date.UTC(2026, 10, 20, 0, 0, index)).toISOString(),
	}));
}

function activity(): ActivityEntry[] {
	return Array.from({ length: ACTIVITY }, (_, index) => ({
		id: `a${index}`,
		toolId: `tool_${index % 35}`,
		kind: "other" as const,
		summary: "y".repeat(40),
		payload: { entries: [1, 2, 3], sections: [1, 2] },
		at: new Date(Date.UTC(2026, 10, 20, 0, 0, index)).toISOString(),
	}));
}

/** 中位数，避开单次抖动。 */
function median(run: () => void, rounds = 40): number {
	const samples: number[] = [];
	for (let index = 0; index < rounds; index += 1) {
		const start = performance.now();
		run();
		samples.push(performance.now() - start);
	}
	samples.sort((left, right) => left - right);
	return samples[Math.floor(samples.length / 2)]!;
}

describe("render budget", () => {
	it("keeps the timeline cheap enough to run on every render", () => {
		const stream = events();
		// 实测中位数 ~0.08ms；这里给到 12ms（仍在一帧之内），
		// 只有「换成 O(n²) 或每次读盘」这类回退才会撞线。
		expect(median(() => void buildTimeline(stream))).toBeLessThan(12);
	});

	it("keeps the merge of calls and results from stalling a frame", () => {
		const timeline = buildTimeline(events());
		const entries = activity();
		// mergeActivity 已在 useMemo 里；这条保证「即使被误调用」也不会拖死一帧。
		expect(median(() => void mergeActivity(timeline.spans, entries, timeline.turns))).toBeLessThan(60);
	});
});
