import { describe, expect, it } from "vitest";
import type { Finding } from "../../domain/audit/findings";
import { buildReport } from "../../domain/report/report";
import { countTurnTools, deriveLiveStatus } from "../../features/workbench/live-status";
import type { ChatState, TaskStreamEntry } from "../../features/workbench/state";

const IDLE: ChatState = { status: "idle", tool: null, cwd: "/work" };

function entry(phase: TaskStreamEntry["phase"], at: number, extra: Partial<TaskStreamEntry> = {}): TaskStreamEntry {
	return {
		id: `${phase}-${at}`,
		phase,
		sessionId: "s1",
		summary: phase,
		at: new Date(at).toISOString(),
		...extra,
	};
}

/** 任务流是「最新在前」的环形数组，测试里按同样的顺序构造。 */
function newestFirst(list: TaskStreamEntry[]): TaskStreamEntry[] {
	return [...list].reverse();
}

const CRITICAL: Finding = { ruleId: "apk.hardcoded-secret", severity: "critical", title: "Secret", detail: "", evidence: [] };

function reportWith(findings: Finding[]) {
	return buildReport({
		mode: "summary",
		target: { path: "/work/live.apk", name: "live.apk", size: 1000, sha256: "a".repeat(64), format: "apk", formatLabel: "APK", generatedAt: "2026-10-25T00:00:00.000Z" },
		findings,
		facts: [],
		sections: [],
		limits: [],
		summary: [],
	});
}

describe("countTurnTools", () => {
	it("counts only the current turn", () => {
		// 排在前面的时间戳更旧，newestFirst 会翻转成「最新在前」。
		const entries = newestFirst([
			entry("turn-start", 1),
			entry("tool-start", 2, { toolName: "scan_binary_strings" }),
			entry("tool-end", 3, { toolName: "scan_binary_strings" }),
			entry("turn-end", 4),
			// 当前这一轮：只有它该被数进来
			entry("turn-start", 5),
			entry("tool-start", 6, { toolName: "triage_binary" }),
			entry("tool-end", 7, { toolName: "triage_binary" }),
		]);
		expect(countTurnTools(entries)).toEqual({ tools: 1, lastTool: "triage_binary", failed: false });
	});

	it("stops at the newest turn boundary", () => {
		const entries = newestFirst([entry("turn-start", 1), entry("tool-start", 2, { toolName: "run_radare" }), entry("turn-end", 3)]);
		expect(countTurnTools(entries).tools).toBe(0);
	});

	it("flags a failed tool in the current turn", () => {
		const entries = newestFirst([
			entry("turn-start", 1),
			entry("tool-start", 2, { toolName: "decompile_android" }),
			entry("tool-end", 3, { toolName: "decompile_android", isError: true }),
		]);
		expect(countTurnTools(entries)).toMatchObject({ tools: 1, failed: true });
	});
});

describe("deriveLiveStatus", () => {
	const base = { chat: IDLE, stream: { entries: [], active: false }, report: null, activePrompt: null };

	it("reports an idle panel when nothing is running", () => {
		const live = deriveLiveStatus(base);
		expect(live.session).toMatchObject({ tone: "idle", streaming: false, disconnected: false });
		expect(live.run).toMatchObject({ tone: "idle", active: false, tools: 0 });
		expect(live.sample).toBeNull();
		expect(live.inject).toEqual({ tone: "idle", name: null });
	});

	it("goes live while the conversation streams and a tool runs", () => {
		const live = deriveLiveStatus({
			...base,
			chat: { status: "streaming", tool: "triage_binary", cwd: "/work" },
			stream: { entries: newestFirst([entry("turn-start", 1), entry("tool-start", 2, { toolName: "triage_binary" })]), active: true },
		});
		expect(live.session).toMatchObject({ tone: "live", tool: "triage_binary" });
		expect(live.run).toMatchObject({ tone: "live", active: true, tools: 1, lastTool: "triage_binary" });
	});

	it("turns the session dot into an alert when the host has no conversation", () => {
		expect(deriveLiveStatus({ ...base, chat: { status: "disconnected", tool: null, cwd: null } }).session).toMatchObject({ tone: "alert", disconnected: true });
	});

	it("escalates the run dot on a tool error", () => {
		const live = deriveLiveStatus({
			...base,
			stream: { entries: newestFirst([entry("turn-start", 1), entry("tool-start", 2, { toolName: "run_radare" }), entry("tool-end", 3, { toolName: "run_radare", isError: true })]), active: false },
		});
		expect(live.run.tone).toBe("alert");
	});

	it("maps the sample grade onto the dot tone", () => {
		const clean = deriveLiveStatus({ ...base, report: reportWith([]) });
		expect(clean.sample).toMatchObject({ tone: "idle", name: "live.apk" });

		// 45 分 = C → live；再加一条 critical 到 90 分 = E → alert。
		const moderate = deriveLiveStatus({ ...base, report: reportWith([CRITICAL]) });
		expect(moderate.sample?.grade).toBe("C");
		expect(moderate.sample?.tone).toBe("live");

		const heavy = deriveLiveStatus({ ...base, report: reportWith([CRITICAL, { ...CRITICAL, ruleId: "apk.debuggable" }]) });
		expect(heavy.sample?.grade).toBe("E");
		expect(heavy.sample?.tone).toBe("alert");
	});

	it("shows the active prompt as the injection state", () => {
		expect(deriveLiveStatus({ ...base, activePrompt: { name: "红队交付" } }).inject).toEqual({ tone: "live", name: "红队交付" });
	});
});
