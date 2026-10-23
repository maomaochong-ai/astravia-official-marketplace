import { describe, expect, it } from "vitest";
import { KERNEL_BLOCK_ID, KERNEL_PRIORITY, buildKernelBlock } from "../domain/kernel";
import { LAB_OFF, labAfter, parseLabCommand } from "../domain/lab-mode";
import { buildHealthReport } from "../features/workbench/services/health";
import { clearPanelBacklog, getAgentPage, publishPanelEvent, setAgentPage, subscribePanel } from "../runtime/panel-channel";
import { TOOL_IDS } from "../tools/ids";

describe("parseLabCommand", () => {
	it("accepts both colon forms and keeps the trailing task", () => {
		expect(parseLabCommand("lab： 分析这个 apk")).toEqual({ action: "enter", rest: "分析这个 apk" });
		expect(parseLabCommand("LAB: dump the license check")).toEqual({ action: "enter", rest: "dump the license check" });
		expect(parseLabCommand("进入实验：脱壳")).toEqual({ action: "enter", rest: "脱壳" });
	});

	it("recognises the exit口令 and nothing else", () => {
		expect(parseLabCommand("退出实验")).toEqual({ action: "exit", rest: "" });
		expect(parseLabCommand("exit lab")).toEqual({ action: "exit", rest: "" });
	});

	it("passes ordinary prompts through untouched", () => {
		const prompt = "这个报错的堆栈怎么读？";
		expect(parseLabCommand(prompt)).toEqual({ action: "none", rest: prompt });
		// 只在开头匹配：句中出现的 lab：不是开关。
		expect(parseLabCommand("帮我看看 lab： 这段").action).toBe("none");
	});
});

describe("labAfter", () => {
	it("stamps the first entry and keeps the original timestamp afterwards", () => {
		const first = labAfter(LAB_OFF, { action: "enter", rest: "" }, "2026-01-02T03:04:05.000Z");
		expect(first).toEqual({ enabled: true, since: "2026-01-02T03:04:05.000Z" });
		const again = labAfter(first, { action: "enter", rest: "" }, "2026-09-09T00:00:00.000Z");
		expect(again.since).toBe("2026-01-02T03:04:05.000Z");
	});

	it("turns off on exit and leaves state alone when there is no command", () => {
		const on = { enabled: true, since: "2026-01-02T03:04:05.000Z" };
		expect(labAfter(on, { action: "exit", rest: "" }, "2026-01-03T00:00:00.000Z")).toEqual(LAB_OFF);
		expect(labAfter(on, { action: "none", rest: "hi" }, "2026-01-03T00:00:00.000Z")).toBe(on);
	});
});

describe("buildKernelBlock", () => {
	it("stays short and refuses patch plans while lab mode is off", () => {
		const text = buildKernelBlock({ lab: LAB_OFF, page: null, tools: [] });
		expect(text).toContain("Lab mode: OFF");
		expect(text).toContain("do not expand shorthand");
		expect(text).not.toContain("Patch table");
		expect(text.split("\n")).toHaveLength(1);
	});

	it("adds the delivery shape, tool list and page hint when lab mode is on", () => {
		const text = buildKernelBlock({
			lab: { enabled: true, since: "2026-01-02T03:04:05.000Z" },
			page: "disasm",
			tools: TOOL_IDS,
		});
		expect(text).toContain("Lab mode: ON (since 2026-01-02)");
		expect(text).toContain("disassemble_range");
		expect(text).toContain("Current panel page: the operator is in the disassembler");
		expect(text).toContain("Patch table");
		expect(text).toContain("Rollback");
	});

	it("omits the unknown page instead of guessing one", () => {
		const text = buildKernelBlock({ lab: LAB_OFF, page: "settings", tools: [] });
		expect(text).not.toContain("Current panel page");
	});

	it("keeps the per-turn block inside a budget the host can afford", () => {
		const off = buildKernelBlock({ lab: LAB_OFF, page: null, tools: TOOL_IDS });
		const on = buildKernelBlock({ lab: { enabled: true, since: "2026-01-02T03:04:05.000Z" }, page: "disasm", tools: TOOL_IDS });
		// 2.4.0 取消了包内常驻块，每轮只付这一份；超预算就是静默吃掉上下文。
		// 2.5.0 工具数从 19 到 20（install_toolchain），2.9.0 到 23（kb_checklist / kb_payloads / ida_status），
		// 再到 25（verify_signature / frida_dump）——每轮都多一份工具名清单。
		// 预算按实际增量上调：数字只在“失控”时才该收紧，而不该因为合理新增就永久钉死。
		expect(off.length).toBeLessThan(700);
		expect(on.length).toBeLessThan(1400);
	});

	it("keeps the block id inside the plugin namespace", () => {
		expect(KERNEL_BLOCK_ID.startsWith("plugin.hanshuang-pojia.")).toBe(true);
		expect(KERNEL_PRIORITY).toBeGreaterThan(0);
	});
});

describe("panel channel", () => {
	it("replays events published before the panel mounted", () => {
		clearPanelBacklog();
		const seen: string[] = [];
		publishPanelEvent({ type: "report", source: "agent", report: { sample: { path: "a.apk" } } as never });
		const stop = subscribePanel(event => seen.push(event.type));
		expect(seen).toEqual(["report"]);
		stop();
	});

	it("stops delivering after unsubscribe and remembers the current page", () => {
		clearPanelBacklog();
		const seen: string[] = [];
		const stop = subscribePanel(event => seen.push(event.type));
		stop();
		publishPanelEvent({ type: "report", source: "agent", report: { sample: { path: "b.apk" } } as never });
		expect(seen).toEqual([]);

		setAgentPage("findings");
		expect(getAgentPage()).toBe("findings");
	});

	it("caps the backlog so a long agent run cannot grow without bound", () => {
		clearPanelBacklog();
		for (let index = 0; index < 60; index += 1) {
			publishPanelEvent({ type: "report", source: "agent", report: { sample: { path: `${index}.apk` } } as never });
		}
		let count = 0;
		const stop = subscribePanel(() => {
			count += 1;
		});
		stop();
		expect(count).toBe(40);
	});
});

describe("buildHealthReport", () => {
	const facts = () => ({
		cwd: "/work",
		persisted: true,
		chatStatus: "idle" as const,
		lab: LAB_OFF,
	});

	it("reports four groups and counts every item exactly once", () => {
		const report = buildHealthReport(facts());
		expect(report.groups.map(group => group.id)).toEqual(["assets", "engine", "tools", "host"]);
		const total = report.groups.reduce((sum, group) => sum + group.items.length, 0);
		expect(report.passed + report.optional + report.failed).toBe(total);
		expect(report.failed).toBe(0);
	});

	it("flags a missing workspace and an off lab mode as warnings, not failures", () => {
		const report = buildHealthReport({ ...facts(), cwd: null, lab: LAB_OFF });
		const host = report.groups.find(group => group.id === "host");
		expect(host?.items.find(entry => entry.id === "host.cwd")?.status).toBe("warn");
		expect(host?.items.find(entry => entry.id === "host.lab")?.status).toBe("warn");
		expect(report.failed).toBe(0);
	});

	it("marks the kit layer as optional because the panel never pretends it answered", () => {
		const report = buildHealthReport(facts());
		const tools = report.groups.find(group => group.id === "tools");
		expect(tools?.items.find(entry => entry.id === "tools.kit")?.status).toBe("warn");
		expect(tools?.items.find(entry => entry.id === "tools.declared")?.detail).toContain("search_docs");
	});
});
