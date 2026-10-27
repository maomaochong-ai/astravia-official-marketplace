import { describe, expect, it } from "vitest";
import {
	CASE_PRESETS,
	MAX_NAME_CHARS,
	assessReadiness,
	assertCaseName,
	parseAuthStatus,
	parseNetworkProfile,
	readinessLine,
	resolvePreset,
	safeTaskName,
	scopeMarkdown,
	seedWorkItems,
	timelineHeader,
	workItemsMarkdown,
	evidenceMarkdown,
	type CaseBrief,
} from "../domain/case/contract";

function brief(overrides: Partial<CaseBrief> = {}): CaseBrief {
	return {
		name: "demo",
		description: "authorised test",
		preset: resolvePreset("offline-sample"),
		authStatus: "pending",
		inScope: [],
		outOfScope: [],
		networkProfile: "offline",
		deliverables: [],
		constraints: [],
		at: "2026-10-27T00:00:00.000Z",
		...overrides,
	};
}

describe("case names", () => {
	it("keeps letters of any script, digits, dashes and underscores", () => {
		expect(safeTaskName("demo")).toBe("demo");
		expect(safeTaskName("项目N")).toBe("项目N");
		expect(safeTaskName("ctf-2026_spring")).toBe("ctf-2026_spring");
		expect(safeTaskName("a b/c")).toBe("a_b_c");
		expect(safeTaskName("../../etc/passwd")).toBe("etc_passwd");
	});

	it("clamps the length and strips leading dots and edges", () => {
		expect(safeTaskName("x".repeat(200))).toHaveLength(MAX_NAME_CHARS);
		expect(safeTaskName("  .hidden  ")).toBe("hidden");
		expect(safeTaskName("__edges__")).toBe("edges");
	});

	it("rejects shapes that would be silently rewritten", () => {
		expect(() => assertCaseName("   ")).toThrow("case name is required");
		expect(() => assertCaseName("a/b")).toThrow("plain directory name");
		expect(() => assertCaseName("a\\b")).toThrow("plain directory name");
		expect(() => assertCaseName("..")).toThrow("must not contain '..'");
		expect(() => assertCaseName("a*")).toThrow("wildcards");
		expect(() => assertCaseName("trailing.")).toThrow("dot or a space");
		expect(assertCaseName(" 项目N ")).toBe("项目N");
	});
});

describe("auth and network vocabulary", () => {
	it("uses the four upstream auth words and the four upstream profiles", () => {
		expect(parseAuthStatus(undefined)).toBe("pending");
		expect(parseAuthStatus("GRANTED")).toBe("granted");
		expect(parseAuthStatus("denied")).toBe("denied");
		expect(parseAuthStatus("unknown")).toBe("unknown");
		expect(() => parseAuthStatus("yes")).toThrow("auth_status must be one of");

		expect(parseNetworkProfile(undefined)).toBe("offline");
		expect(parseNetworkProfile("lab")).toBe("lab_only");
		expect(parseNetworkProfile("authorized")).toBe("authorized_target_only");
		expect(parseNetworkProfile("auth")).toBe("authorized_target_only");
		expect(parseNetworkProfile("offline_only")).toBe("offline");
		expect(parseNetworkProfile("Unrestricted_Lab")).toBe("unrestricted_lab");
		expect(() => parseNetworkProfile("wan")).toThrow("network_profile must be one of");
	});
});

describe("presets", () => {
	it("resolves ids and the upstream aliases", () => {
		expect(resolvePreset(undefined).id).toBe("offline-sample");
		expect(resolvePreset("own-sample").id).toBe("offline-sample");
		expect(resolvePreset("local-sample").id).toBe("offline-sample");
		expect(resolvePreset("CTF").id).toBe("ctf-public");
		expect(resolvePreset("lab-only").id).toBe("own-system");
		expect(() => resolvePreset("pentest")).toThrow('unknown preset "pentest"');
	});

	it("records the authorisation the preset stands for, and declares no assets", () => {
		// 上游 case-init 里 -Preset 会顺手把 -AuthGranted 打开：选预设本身就是一次声明。
		for (const preset of CASE_PRESETS) {
			expect(preset.authStatus).toBe("granted");
			expect(preset.authBasis.length).toBeGreaterThan(0);
			expect(preset.evidenceOfAuth.length).toBeGreaterThan(0);
			// 但预设不带资产：凭空写一条 in_scope 会把闸门点亮而实际什么都没纳入范围。
			expect(preset).not.toHaveProperty("inScope");
			expect(assessReadiness({ authStatus: preset.authStatus, inScope: [], networkProfile: preset.networkProfile, sample: "" }).ready).toBe(false);
		}
		expect(CASE_PRESETS.map(preset => preset.networkProfile)).toEqual(["offline", "authorized_target_only", "lab_only"]);
	});
});

describe("ready_for_act", () => {
	it("stays shut until authorisation and scope line up", () => {
		expect(assessReadiness(brief()).ready).toBe(false);
		expect(assessReadiness(brief()).blockers).toEqual([
			"authorisation not recorded (auth_status=pending)",
			"no in-scope assets declared",
			"offline profile needs an explicit sample",
		]);

		const grantedOnly = assessReadiness(brief({ authStatus: "granted" }));
		expect(grantedOnly.ready).toBe(false);
		expect(grantedOnly.blockers).toEqual(["no in-scope assets declared", "offline profile needs an explicit sample"]);

		const scopedOnly = assessReadiness(brief({ inScope: ["app.apk"], sample: "samples/app.apk" }));
		expect(scopedOnly.blockers).toEqual(["authorisation not recorded (auth_status=pending)"]);
	});

	it("needs an explicit sample offline, and any non-offline profile stands on its own", () => {
		const offline = brief({ authStatus: "granted", inScope: ["app.apk"] });
		expect(assessReadiness(offline).blockers).toEqual(["offline profile needs an explicit sample"]);
		expect(assessReadiness({ ...offline, sample: "samples/app.apk" }).ready).toBe(true);

		// A network case needs no sample file: the asset is the target.
		for (const networkProfile of ["lab_only", "authorized_target_only", "unrestricted_lab"] as const) {
			expect(assessReadiness({ authStatus: "granted", inScope: ["https://range.example/"], networkProfile }).ready).toBe(true);
		}
	});

	it("fails closed on a word it does not know", () => {
		expect(assessReadiness({ authStatus: "not-required", inScope: ["app.apk"], sample: "samples/app.apk", networkProfile: "offline" }).blockers).toEqual([
			"authorisation not recorded (auth_status=not-required)",
		]);
		expect(assessReadiness({ authStatus: "granted", inScope: ["app.apk"], networkProfile: "public-internet" }).blockers).toEqual([
			"network profile not recognised (profile=public-internet)",
		]);
		expect(assessReadiness({ authStatus: "granted", inScope: ["app.apk"], networkProfile: "" }).ready).toBe(false);
	});

	it("reports the gate as a sentence, never a bare boolean", () => {
		expect(readinessLine(assessReadiness(brief()))).toContain("ready_for_act: no — ");
		expect(
			readinessLine(assessReadiness(brief({ authStatus: "granted", inScope: ["app.apk"], sample: "samples/app.apk" }))),
		).toBe("ready_for_act: yes (authorisation recorded, in-scope assets declared)");
	});
});

describe("rendered documents", () => {
	it("writes every upstream scope section, with (not provided) for the gaps", () => {
		const markdown = scopeMarkdown(brief());
		for (const heading of [
			"## meta",
			"## auth",
			"## in_scope",
			"## out_of_scope",
			"## network_profile",
			"## deliverables",
			"## constraints",
			"## signoff",
			"## ops_refs",
		]) {
			expect(markdown).toContain(heading);
		}
		expect(markdown).toContain("- case_id: demo");
		expect(markdown).toContain("- status: pending");
		expect(markdown).toContain("- MUST NOT proceed if status != granted");
		expect(markdown).toContain("(not provided)");
		expect(markdown).toContain("- ready_for_act: false");
		expect(markdown).toContain("  - authorisation not recorded");

		const ready = scopeMarkdown(
			brief({ authStatus: "granted", authBasis: "own_system", inScope: ["app.apk"], sample: "samples/app.apk" }),
		);
		expect(ready).toContain("- ready_for_act: true");
		expect(ready).toContain("- blockers: []");
		expect(ready).toContain("  - [x] auth.status = granted");
		expect(ready).toContain("- assets:\n  - app.apk");
	});

	it("seeds the upstream bootstrap item and one work item per in-scope asset", () => {
		expect(seedWorkItems({ inScope: [] })).toEqual([
			{ id: "WI-001", title: "Establish scope and auth", target: "case", surface: "process", status: "in_progress" },
		]);
		const items = seedWorkItems({ inScope: ["app.apk", "https://range.example/"] });
		expect(items.map(item => item.id)).toEqual(["WI-001", "WI-002", "WI-003"]);
		expect(items[1]).toMatchObject({ title: "Baseline and analyse app.apk", surface: "android" });
		expect(items[2]!.surface).toBe("web");
	});

	it("keeps the work-item table parseable and the coverage list intact", () => {
		const markdown = workItemsMarkdown("demo", brief({ inScope: ["app.apk"] }));
		expect(markdown).toContain("| ID | title | role | targets | surface | status | evidence | notes |");
		expect(markdown).toContain("| WI-001 | Establish scope and auth | lead | case | process | in_progress | | |");
		expect(markdown).toContain("| WI-002 | Baseline and analyse app.apk | lead | app.apk | android | todo | | |");
		expect(markdown).toContain("- [ ] Report written under report/");
	});

	it("keeps a pipe or a newline in an asset name from breaking the table", () => {
		// 资产名是人写的：`host a | port 22` 直接拼进单元格就会多出一列，
		// 于是状态列被读成 `port`——进度静默错位比报错更贵。
		const markdown = workItemsMarkdown("demo", brief({ inScope: ["host a | port 22", "line\nbreak"] }));
		const rows = markdown.split("\n").filter(line => line.startsWith("| WI-"));
		expect(rows).toHaveLength(3);
		for (const row of rows) {
			expect(row.split("|")).toHaveLength(10); // 首尾空段 + 8 列
			expect(row).toMatch(/\| (todo|in_progress) \|/);
		}
	});

	it("states the evidence numbering contract and the timeline gate", () => {
		const evidence = evidenceMarkdown("demo");
		expect(evidence).toContain("E-###-<slug>.md");
		expect(evidence).toContain("- `repro_command:`");
		expect(evidence).toContain("- `linked_workitem:`");
		const timeline = timelineHeader("demo", "2026-10-27T00:00:00.000Z", brief());
		expect(timeline).toContain("# Timeline — demo");
		expect(timeline).toContain("## 2026-10-27T00:00:00.000Z | lead | init");
		expect(timeline).toContain("case directory created; scope pending");
		expect(timeline).toContain("- command_or_ref: init_task");
	});
});
