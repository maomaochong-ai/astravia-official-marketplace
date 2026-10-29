import { describe, expect, it } from "vitest";
import {
	CASE_PRESETS,
	MAX_NAME_CHARS,
	assertCaseName,
	parseAuthStatus,
	parseNetworkProfile,
	resolvePreset,
	safeTaskName,
	evidenceMarkdown,
	scopeMarkdown,
	timelineHeader,
	type CaseBrief,
} from "../../domain/case/contract";

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
		}
		expect(CASE_PRESETS.map(preset => preset.networkProfile)).toEqual(["offline", "authorized_target_only", "lab_only"]);
	});
});

describe("no readiness gate", () => {
	it("records auth as a fact and never derives a proceed verdict", async () => {
		// 上游没有门禁，这里也不该有：契约模块不再导出任何判定函数。
		const contract = await import("../../domain/case/contract");
		expect(contract).not.toHaveProperty("assessReadiness");
		expect(contract).not.toHaveProperty("readinessLine");
		expect(contract).not.toHaveProperty("seedWorkItems");
		expect(contract).not.toHaveProperty("workItemsMarkdown");
	});

	it("keeps the recorded status even when nobody would approve it", () => {
		// denied / unknown 一样能开工：记录的价值在于事后能说清当时的依据。
		for (const authStatus of ["pending", "denied", "unknown"] as const) {
			const markdown = scopeMarkdown(brief({ authStatus, inScope: ["app.apk"] }));
			expect(markdown).toContain(`- status: ${authStatus}`);
			expect(markdown).not.toContain("ready_for_act");
			expect(markdown).not.toContain("MUST NOT proceed");
		}
	});

	it("writes the scope with no assets declared, instead of refusing", () => {
		const markdown = scopeMarkdown(brief());
		expect(markdown).toContain("- assets:\n  []");
		expect(markdown).not.toContain("[ ]");
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
			"## ops_refs",
		]) {
			expect(markdown).toContain(heading);
		}
		expect(markdown).toContain("- case_id: demo");
		expect(markdown).toContain("- status: pending");
		expect(markdown).toContain("(not provided)");

		const ready = scopeMarkdown(
			brief({ authStatus: "granted", authBasis: "own_system", inScope: ["app.apk"], sample: "samples/app.apk" }),
		);
		expect(ready).toContain("- status: granted");
		expect(ready).toContain("- assets:\n  - app.apk");
	});

	it("lists every declared asset as a nested bullet", () => {
		const markdown = scopeMarkdown(brief({ inScope: ["app.apk", "https://range.example/"] }));
		expect(markdown).toContain("- assets:\n  - app.apk\n  - https://range.example/");
	});

	it("keeps an asset name with a pipe or a newline from breaking the section", () => {
		// 资产名是人写的：带 `|` 或换行时若原样拼进 `  - <item>`，下一行就会被读成新的键。
		const markdown = scopeMarkdown(brief({ inScope: ["host a | port 22", "line\nbreak"] }));
		const lines = markdown.split("\n").filter(line => line.startsWith("  - ") && !line.startsWith("  - ["));
		expect(lines).toEqual(["  - host a | port 22", "  - line break"]);
	});

	it("states the evidence numbering contract and the timeline gate", () => {
		const evidence = evidenceMarkdown("demo");
		expect(evidence).toContain("E-###-<slug>.md");
		expect(evidence).toContain("- `repro_command:`");
		const timeline = timelineHeader("demo", "2026-10-27T00:00:00.000Z", brief());
		expect(timeline).toContain("# Timeline — demo");
		expect(timeline).toContain("## 2026-10-27T00:00:00.000Z | lead | init");
		expect(timeline).toContain("case directory created; preset offline-sample, 0 in-scope asset(s)");
		expect(timeline).toContain("- command_or_ref: init_task");
	});
});
