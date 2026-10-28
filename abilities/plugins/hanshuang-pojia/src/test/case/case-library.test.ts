import { describe, expect, it } from "vitest";
import {
	MAX_CASE_DIRECTORIES,
	countEvidence,
	parseScope,
	rankCases,
	renderCaseIndex,
	scanCases,
	type CaseDirEntry,
	type CaseReadPort,
	type CaseRecord,
} from "../../domain/case/library";
import { resolvePreset, scopeMarkdown, type CaseBrief } from "../../domain/case/contract";

function brief(overrides: Partial<CaseBrief> = {}): CaseBrief {
	return {
		name: "demo",
		preset: resolvePreset("ctf-public"),
		authStatus: "granted",
		authBasis: "challenge rules of engagement",
		inScope: ["challenge.case-one"],
		outOfScope: ["everything else"],
		networkProfile: "authorized_target_only",
		deliverables: ["reports/<case>_security_assessment_report.md"],
		constraints: [],
		at: "2026-10-27T00:00:00.000Z",
		...overrides,
	};
}

/** 只有 readDir / readText 两个口的假文件树：目录由键的前缀推出来。 */
function memoryPort(files: Record<string, string>): CaseReadPort {
	const names = new Map(Object.entries(files));
	const directories = new Set<string>();
	for (const path of names.keys()) {
		const parts = path.split("/").filter(Boolean);
		for (let index = 1; index < parts.length; index += 1) directories.add(`/${parts.slice(0, index).join("/")}`);
	}
	const children = (path: string): CaseDirEntry[] => {
		const base = path.replace(/\/$/, "");
		const out = new Map<string, CaseDirEntry>();
		for (const directory of directories) {
			if (!directory.startsWith(`${base}/`)) continue;
			const rest = directory.slice(base.length + 1);
			if (rest.includes("/")) continue;
			out.set(rest, { name: rest, path: directory, isDirectory: true, modifiedAt: 0 });
		}
		for (const path of names.keys()) {
			const parent = path.slice(0, path.lastIndexOf("/"));
			if (parent !== base) continue;
			const name = path.slice(parent.length + 1);
			out.set(name, { name, path, isDirectory: false, modifiedAt: 0 });
		}
		return [...out.values()];
	};
	return {
		readDir: async path => {
			const entries = children(path);
			if (entries.length === 0) throw new Error(`ENOENT ${path}`);
			return entries;
		},
		readText: async path => names.get(path) ?? null,
	};
}

function caseFiles(name: string, overrides: Partial<CaseBrief> = {}): Record<string, string> {
	return { [`/work/cases/${name}/scope.md`]: scopeMarkdown(brief({ name, ...overrides })) };
}

describe("scope parsing", () => {
	it("reads back what the contract wrote", () => {
		const parsed = parseScope(scopeMarkdown(brief()));
		expect(parsed.preset).toBe("ctf-public");
		expect(parsed.authStatus).toBe("granted");
		expect(parsed.networkProfile).toBe("authorized_target_only");
		expect(parsed.inScope).toEqual(["challenge.case-one"]);
		expect(parsed.outOfScope).toEqual(["everything else"]);
		expect(parsed.deliverables).toEqual(["reports/<case>_security_assessment_report.md"]);
	});

	it("treats (not provided) as absence rather than as a value", () => {
		const parsed = parseScope(scopeMarkdown(brief({ inScope: [], authBasis: undefined })));
		expect(parsed.inScope).toEqual([]);
		expect(parsed.authBasis).toBeUndefined();
		expect(parsed.sample).toBeUndefined();
	});

	it("survives a hand-edited scope with sections missing", () => {
		const parsed = parseScope("## auth\n- status: granted\n");
		expect(parsed.authStatus).toBe("granted");
		expect(parsed.inScope).toEqual([]);
		expect(parsed.preset).toBeUndefined();
	});

	it("records an unknown word as written rather than rejecting the case", () => {
		// 没有门禁就没有「未知即关闭」：读到什么记什么，索引不做二次判定。
		const parsed = parseScope(scopeMarkdown(brief({ authStatus: "granted" })).replace("- status: granted", "- status: yes"));
		expect(parsed.authStatus).toBe("yes");
	});
});

describe("evidence counting", () => {
	it("counts E-### files only", () => {
		const entries: CaseDirEntry[] = [
			{ name: "E-001-entry-point.md", path: "/e/E-001-entry-point.md", isDirectory: false },
			{ name: "E-002.patch", path: "/e/E-002.patch", isDirectory: false },
			{ name: "README.md", path: "/e/README.md", isDirectory: false },
			{ name: "E-003", path: "/e/E-003", isDirectory: true },
		];
		expect(countEvidence(entries)).toBe(2);
	});
});

describe("scanCases", () => {
	it("finds cases in both namespaces and ignores directories without a scope", async () => {
		const port = memoryPort({
			...caseFiles("alpha"),
			"/work/work/beta/scope.md": scopeMarkdown(brief({ name: "beta", authStatus: "pending" })),
			"/work/cases/nested/deeper/scope.md": scopeMarkdown(brief({ name: "deeper" })),
			"/work/cases/not-a-case/README.md": "# no declaration",
		});
		const scan = await scanCases(port, "/work");
		expect(scan.cases.map(record => record.name)).toEqual(["alpha", "beta"]);
		expect(scan.cases[0]!.preset).toBe("ctf-public");
		expect(scan.cases[1]!.authStatus).toBe("pending");
		expect(scan.truncated).toBe(0);
	});

	it("opens a pending case the same as a granted one", async () => {
		// 授权状态是记录，不是开关：pending 的案例照样进索引、照样能读。
		const scope = scopeMarkdown(
			brief({ name: "late", authStatus: "pending", authBasis: undefined, networkProfile: "offline", sample: "samples/app.apk" }),
		);
		const scan = await scanCases(memoryPort({ "/work/cases/late/scope.md": scope }), "/work");
		expect(scan.cases).toHaveLength(1);
		expect(scan.cases[0]!.authStatus).toBe("pending");
		expect(scan.cases[0]!.inScope).toEqual(["challenge.case-one"]);
	});

	it("counts evidence files and decision notes", async () => {
		const port = memoryPort({
			...caseFiles("alpha"),
			"/work/cases/alpha/evidence/E-001-triage.md": "# e1",
			"/work/cases/alpha/evidence/E-002-patch.md": "# e2",
			"/work/cases/alpha/.agents/notes/implemented/architecture/2026-10-20-gate.md": "# kept",
			"/work/cases/alpha/.agents/notes/rejected/feature/2026-10-21-proxy.md": "# dropped",
		});
		const scan = await scanCases(port, "/work");
		expect(scan.cases[0]!.evidenceCount).toBe(2);
		expect(scan.cases[0]!.notes).toEqual({ implemented: 1, rejected: 1 });
	});

	it("reports the cap instead of silently dropping directories", async () => {
		const files: Record<string, string> = {};
		for (let index = 0; index < MAX_CASE_DIRECTORIES + 3; index += 1) {
			const name = `case-${String(index).padStart(3, "0")}`;
			files[`/work/cases/${name}/scope.md`] = scopeMarkdown(brief({ name }));
		}
		const scan = await scanCases(memoryPort(files), "/work");
		expect(scan.cases).toHaveLength(MAX_CASE_DIRECTORIES);
		expect(scan.truncated).toBe(3);
	});

	it("returns nothing rather than throwing when the namespaces are absent", async () => {
		const scan = await scanCases(memoryPort({}), "/empty");
		expect(scan.cases).toEqual([]);
		expect(renderCaseIndex(scan, [])).toContain("No cases under /empty.");
	});
});

function record(name: string, overrides: Partial<CaseRecord> = {}): CaseRecord {
	return {
		name,
		path: `/work/cases/${name}`,
		preset: "offline-sample",
		authStatus: "granted",
		networkProfile: "offline",
		inScope: ["app.apk"],
		outOfScope: [],
		deliverables: ["reports/report.md"],
		evidenceCount: 0,
		notes: { implemented: 0, rejected: 0 },
		...overrides,
	};
}

describe("rankCases", () => {
	it("weights a name match above an asset match above metadata", () => {
		const hits = rankCases(
			[
				record("frida-lab", { inScope: ["device"] }),
				record("other", { inScope: ["frida-gadget"] }),
				record("meta", { deliverables: ["frida-notes.md"] }),
			],
			"frida",
		);
		expect(hits.map(hit => hit.record.name)).toEqual(["frida-lab", "other", "meta"]);
		expect(hits[0]!.reasons).toContain('name matches "frida"');
		expect(hits[1]!.reasons).toContain('in-scope asset matches "frida"');
	});

	it("keeps only matching cases once a query is given, and lists everything without one", () => {
		const pool = [record("alpha"), record("beta", { inScope: ["https"] })];
		expect(rankCases(pool, "https").map(hit => hit.record.name)).toEqual(["beta"]);
		expect(rankCases(pool, "").map(hit => hit.record.name)).toEqual(["alpha", "beta"]);
		expect(rankCases(pool, "nosuchthing")).toEqual([]);
	});

	it("breaks ties by name and honours limit", () => {
		// 没有「就绪优先」加权：同分只按名字排，排序不看授权状态。
		const pool = [record("zeta", { authStatus: "pending" }), record("alpha", { authStatus: "granted" })];
		expect(rankCases(pool, "").map(hit => hit.record.name)).toEqual(["alpha", "zeta"]);
		expect(rankCases(pool, "", { limit: 1 })).toHaveLength(1);
	});
});

describe("renderCaseIndex", () => {
	it("states the facts and the next file to read", () => {
		const scan = { root: "/work", cases: [record("alpha")], truncated: 0 };
		const text = renderCaseIndex(scan, rankCases(scan.cases, ""));
		expect(text).toContain("Case index — /work (1 case)");
		expect(text).toContain("### alpha");
		expect(text).toContain("- preset offline-sample · network offline · in scope 1 · evidence 0");
		expect(text).toContain("- next: read /work/cases/alpha/scope.md then /work/cases/alpha/evidence/");
	});

	it("says so when a query matches nothing", () => {
		const scan = { root: "/work", cases: [record("alpha")], truncated: 0 };
		const text = renderCaseIndex(scan, [], "nosuchthing");
		expect(text).toContain('No case matches "nosuchthing".');
	});

	it("never leaks an undefined query into the sentence", () => {
		const text = renderCaseIndex({ root: "/work", cases: [record("alpha")], truncated: 0 }, [], undefined);
		expect(text).not.toContain("undefined");
	});

	it("surfaces truncation", () => {
		const text = renderCaseIndex({ root: "/work", cases: [record("blocked")], truncated: 7 }, rankCases([record("blocked")], ""));
		expect(text).toContain("Truncated: 7 more case directories were not read.");
	});
});
