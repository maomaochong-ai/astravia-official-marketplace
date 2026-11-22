import { describe, expect, it } from "vitest";
import type { TriageReport } from "../../domain/report/report";
import { deriveObservations, MAX_OBSERVATIONS, type Translate } from "../../features/workbench/observations";
import type { ActivityEntry, TaskStreamEntry } from "../../features/workbench/state";
import { buildTimeline } from "../../features/workbench/timeline";
import { probeRecord } from "./fixtures";

/**
 * The observation board is the answer to "this page only had a load-sample button".
 *
 * These assertions pin the decision order and the "don't invent facts" rule, not the
 * wording — the wording lives in the locale files.
 */
const t: Translate = ((key: string, params?: Record<string, string | number>) =>
	params ? `${key}:${Object.values(params).join(",")}` : key) as Translate;

const report = (severities: string[]): TriageReport =>
	({
		target: {
			name: "app.apk",
			path: ".hanshuang/samples/app.apk",
			format: "apk",
			formatLabel: "APK",
			size: 1024,
			sha256: "a".repeat(64),
			generatedAt: "2026-11-22T10:00:00.000Z",
		},
		risk: { score: 60, grade: "C", drivers: [] },
		findings: severities.map((severity, index) => ({
			ruleId: `rule.${index}`,
			severity,
			title: `rule ${index}`,
			detail: "",
			evidence: [],
		})),
		components: [],
		permissions: [],
		meta: {},
	}) as unknown as TriageReport;

const activity = (over: Partial<ActivityEntry> & { id: string }): ActivityEntry => ({
	toolId: "triage_binary",
	kind: "report",
	summary: "APK · 7 findings",
	at: "2026-11-22T10:00:00.000Z",
	...over,
});

const stream: TaskStreamEntry[] = [
	{ id: "t2", phase: "tool-end", sessionId: "s", toolName: "triage_binary", isError: false, summary: "done", at: "2026-11-22T10:00:02.000Z" },
	{ id: "t1", phase: "tool-start", sessionId: "s", toolName: "triage_binary", summary: "run", at: "2026-11-22T10:00:00.000Z" },
	{ id: "turn", phase: "turn-start", sessionId: "s", summary: "turn", at: "2026-11-22T09:59:59.000Z" },
];

function run(over: Partial<Parameters<typeof deriveObservations>[0]> = {}) {
	return deriveObservations(
		{
			report: null,
			activity: [],
			stream: { entries: [], active: false },
			timeline: buildTimeline([]),
			probe: null,
			selectedPath: null,
			phase: "idle",
			...over,
		},
		t,
	);
}

describe("conversation observations", () => {
	it("puts a failed call first and links to the activity stream", () => {
		const rows = run({
			activity: [activity({ id: "a1", isError: true, summary: "CapabilityError" }), activity({ id: "a2", toolId: "scan_strings" })],
		});
		expect(rows[0]?.kind).toBe("block");
		expect(rows[0]?.tone).toBe("alert");
		expect(rows[0]?.detail).toBe("CapabilityError");
		expect(rows[0]?.action).toEqual({ labelKey: "obs.act.activity", page: "activity" });
	});

	it("lists only the rungs that were actually blocked", () => {
		const rows = run({ probe: probeRecord });
		const probes = rows.filter(row => row.kind === "probe");
		expect(probes).toHaveLength(1);
		// 第 1 档是 answered，它属于背景，不是观测点。
		expect(probes[0]?.id).toBe("probe-2");
		expect(probes[0]?.detail).toBe("cannot assist");
		expect(probes[0]?.action?.page).toBe("prompts");
	});

	it("counts high-severity findings and names the rules that drive them", () => {
		const rows = run({ report: report(["high", "critical", "low"]) });
		const risk = rows.find(row => row.kind === "risk");
		expect(risk?.tone).toBe("alert");
		expect(risk?.title).toContain("2"); // high + critical
		expect(risk?.detail).toContain("rule.0");
		expect(risk?.action?.prompt).toBeTruthy();
	});

	it("still says something when nothing matched", () => {
		const rows = run({ report: report(["low"]) });
		const risk = rows.find(row => row.kind === "risk");
		expect(risk?.tone).toBe("idle");
		expect(risk?.title).toContain("obs.title.clean");
	});

	it("reports the current turn and the latest successful result", () => {
		const rows = run({
			stream: { entries: stream, active: true },
			timeline: buildTimeline(stream),
			activity: [activity({ id: "err", isError: true }), activity({ id: "ok", toolId: "probe_refusal", summary: "6 rungs" })],
		});
		const turn = rows.find(row => row.kind === "turn");
		expect(turn?.tone).toBe("live");
		const latest = rows.find(row => row.kind === "tool");
		// 最近结果是「最近一条没失败的」，不是「最近一条」——失败已单独占一行。
		expect(latest?.detail).toBe("6 rungs");
		expect(latest?.action?.prompt).toContain("probe_refusal");
	});

	it("offers a sample row instead of a dead end when there is no report", () => {
		const rows = run({ selectedPath: ".hanshuang/samples/app.apk" });
		const sample = rows.find(row => row.kind === "sample");
		expect(sample?.detail).toBe(".hanshuang/samples/app.apk");
		expect(sample?.action).toEqual({ labelKey: "obs.act.samples", page: "samples" });
	});

	it("marks the sample row live while the panel is analysing", () => {
		const rows = run({ phase: "loading" });
		expect(rows.find(row => row.kind === "sample")?.tone).toBe("live");
	});

	it("never returns more rows than the cap", () => {
		const rows = run({
			report: report(["high"]),
			probe: probeRecord,
			stream: { entries: stream, active: true },
			timeline: buildTimeline(stream),
			activity: [
				activity({ id: "e1", isError: true }),
				activity({ id: "e2", isError: true }),
				activity({ id: "e3", isError: true }),
				activity({ id: "ok" }),
			],
		});
		expect(rows.length).toBeLessThanOrEqual(MAX_OBSERVATIONS);
	});
});
