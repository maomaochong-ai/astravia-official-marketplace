import { describe, expect, it } from "vitest";
import {
	beginRun,
	finishRun,
	handsOffToUser,
	markStep,
	newerRun,
	planFor,
	readAutomationRun,
	withLanding,
	type AutomationRun,
} from "./boardmix-run";

const AT = "2026-11-05T10:00:00.000Z";

function started(): AutomationRun {
	return beginRun({ recipe: "focus", reason: "prompt", at: AT, id: "run-1" });
}

describe("planFor", () => {
	it("每次运行都从面板开始，落到页面结束", () => {
		expect(planFor("focus")).toEqual(["tab", "navigate", "settle"]);
		expect(planFor("open-url")[0]).toBe("tab");
	});

	it("只有把最后一步交给人的 recipe 才有 handoff", () => {
		expect(handsOffToUser("create")).toBe(true);
		expect(handsOffToUser("ai-ppt")).toBe(true);
		expect(handsOffToUser("focus")).toBe(false);
		expect(handsOffToUser("open-url")).toBe(false);
	});
});

describe("markStep", () => {
	it("只改目标步骤，其余保持原样", () => {
		const before = started();
		const after = markStep(before, "navigate", "done", "https://boardmix.cn/app/", AT);
		expect(after).not.toBe(before);
		expect(after.steps.find(step => step.key === "navigate")?.status).toBe("done");
		expect(after.steps.find(step => step.key === "tab")?.status).toBe("pending");
		expect(before.steps.every(step => step.status === "pending")).toBe(true);
	});
});

describe("finishRun / withLanding", () => {
	it("结束时间与落点都落在记录上", () => {
		const done = withLanding(
			finishRun(started(), "done", null, "2026-11-05T10:00:02.000Z"),
			{ url: "https://boardmix.cn/app/", phase: "workspace", seedLevel: 2 },
		);
		expect(done.status).toBe("done");
		expect(done.endedAt).toBe("2026-11-05T10:00:02.000Z");
		expect(done.landing?.phase).toBe("workspace");
	});
});

describe("readAutomationRun", () => {
	it("能读回自己写出去的那一份", () => {
		const run = markStep(started(), "tab", "done", "panel-open", AT);
		const parsed = readAutomationRun(JSON.parse(JSON.stringify(run)));
		expect(parsed?.id).toBe("run-1");
		expect(parsed?.recipe).toBe("focus");
		expect(parsed?.steps).toHaveLength(3);
	});

	it("容忍工具返回体里多出来的字段", () => {
		const run = started();
		const parsed = readAutomationRun({ ...run, ok: true, next: "report the address" });
		expect(parsed?.status).toBe("running");
	});

	it("形状不对就返回 null，不猜", () => {
		expect(readAutomationRun(null)).toBeNull();
		expect(readAutomationRun({})).toBeNull();
		expect(readAutomationRun({ ...started(), recipe: "nope" })).toBeNull();
		expect(readAutomationRun({ ...started(), steps: [{ key: "tab", status: "weird" }] })).toBeNull();
		expect(readAutomationRun({ ...started(), steps: [] })).toBeNull();
	});
});

describe("newerRun", () => {
	const older = { ...started(), startedAt: "2026-11-05T09:00:00.000Z" };
	const newer = { ...started(), startedAt: "2026-11-05T11:00:00.000Z" };

	it("按开始时间取新的那份", () => {
		expect(newerRun(older, newer)?.startedAt).toBe(newer.startedAt);
		expect(newerRun(newer, older)?.startedAt).toBe(newer.startedAt);
	});

	it("任意一边为空时不丢另一边的值", () => {
		expect(newerRun(null, newer)?.startedAt).toBe(newer.startedAt);
		expect(newerRun(newer, null)?.startedAt).toBe(newer.startedAt);
		expect(newerRun(null, null)).toBeNull();
	});
});
