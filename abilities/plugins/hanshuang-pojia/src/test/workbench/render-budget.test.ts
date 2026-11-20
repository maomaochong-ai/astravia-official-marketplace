import { describe, expect, it } from "vitest";
import { buildTimeline, mergeActivity } from "../../features/workbench/timeline";
import type { ActivityEntry, TaskStreamEntry } from "../../features/workbench/state";

/**
 * 渲染预算：把「每帧都会跑一次的纯函数」代价量出来，并钉一个上限。
 *
 * 为什么要这条测试：面板卡顿时，第一嫌疑是「某个 O(n) 的东西被放在渲染路径上」。
 * 逐个去读代码猜很慢；量出来就知道是哪一个、值不值得改。
 * 这里用**真实尺寸**：事件流上限 80 条（MAX_TASKS）、活动流上限 200 条（MAX_ACTIVITY）。
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

/** 取 N 次调用的中位数，避免单次抖动。 */
function cost(run: () => void, rounds = 200): number {
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
	it("keeps the per-render cost of the timeline well under a frame", () => {
		const stream = events();
		const perCall = cost(() => void buildTimeline(stream));

		// 一帧 16ms；面板里 60fps 下每帧能分给这里的是零头。
		// 上限放在 2ms：超过就说明它不该在渲染路径上（应该 memo 起来）。
		expect(perCall).toBeLessThan(2);
	});

	it("keeps the merge of calls and results cheap enough to memoise by identity", () => {
		const timeline = buildTimeline(events());
		const entries = activity();
		const perCall = cost(() => void mergeActivity(timeline.spans, entries, timeline.turns));

		// mergeActivity 已经在 useMemo 里；这条只保证「即使被误调用也不会拖死一帧」。
		expect(perCall).toBeLessThan(8);
	});
});
