import { describe, expect, it } from "vitest";
import {
	MAX_CASE_DIRECTORIES,
	countEvidence,
	parseScope,
	parseWorkItems,
	rankCases,
	renderCaseIndex,
	scanCases,
	type CaseDirEntry,
	type CaseRecord,
	type CaseReadPort,
} from "../domain/case/library";
import { resolvePreset, scopeMarkdown, workItemsMarkdown, type CaseBrief } from "../domain/case/contract";

function brief(overrides: Partial<CaseBrief> = {}): CaseBrief {
	return {
		name: "demo",
		preset: resolvePreset("ctf-public"),
		authStatus: "granted",
		authBasis: "challenge rules of engagement",
		inScope: ["challenge.case-one"],
		outOfScope: ["everything else"],
		networkProfile: "authorized_target_only",
		deliverables: ["report/<case>_security_assessment_report.md"],
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
	const record = brief({ name, ...overrides });
	return {
		[`/work/cases/${name}/scope.md`]: scopeMarkdown(record),
		[`/work/cases/${name}/workitems.md`]: workItemsMarkdown(name, record),
	};
}

describe("scope parsing", () => {
	it("reads back what the contract wrote", () => {
		const parsed = parseScope(scopeMarkdown(brief()));
		expect(parsed.preset).toBe("ctf-public");
		expect(parsed.authStatus).toBe("granted");
		expect(parsed.networkProfile).toBe("authorized_target_only");
		expect(parsed.inScope).toEqual(["challenge.case-one"]);
		expect(parsed.outOfScope).toEqual(["everything else"]);
		expect(parsed.deliverables).toEqual(["report/<case>_security_assessment_report.md"]);
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
});

describe("work items and evidence counting", () => {
	it("counts only table rows, not the prose above them", () => {
		const items = parseWorkItems(workItemsMarkdown("demo", brief({ inScope: ["a", "b"] })));
		expect(items).toHaveLength(3);
		expect(items[0]).toEqual({
			id: "WI-001",
			title: "Establish scope and auth",
			target: "case",
			surface: "process",
			status: "in_progress",
		});
		expect(items[1]).toMatchObject({ id: "WI-002", title: "Baseline and analyse a", status: "todo" });
		expect(
			parseWorkItems("| WI-002 | x | lead | target | binary | done | E-001 | |"),
		).toEqual([{ id: "WI-002", title: "x", target: "target", surface: "binary", status: "done" }]);
		expect(parseWorkItems("no table here")).toEqual([]);
		// A four-column table is the v1 shape; it must not be half-read as v2.
		expect(parseWorkItems("| WI-002 | x | done | E-001 |")).toEqual([]);
	});

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
		expect(scan.cases[0]!.ready).toBe(true);
		expect(scan.cases[1]!.ready).toBe(false);
		expect(scan.truncated).toBe(0);
	});

	it("re-derives readiness instead of trusting the signoff written into the file", async () => {
		// 手改过的 scope.md 声称就绪，授权却是待定；索引必须以推导结果为准。
		const forged = scopeMarkdown(brief({ name: "stale", authStatus: "pending" })).replace(
			"- ready_for_act: true",
			"- ready_for_act: false",
		);
		const port = memoryPort({
			"/work/cases/stale/scope.md": forged,
			"/work/cases/no-sample/scope.md": scopeMarkdown(
				brief({ name: "no-sample", networkProfile: "offline", sample: undefined }),
			),
		});
		const scan = await scanCases(port, "/work");
		const byName = new Map(scan.cases.map(record => [record.name, record]));
		expect(byName.get("stale")!.ready).toBe(false);
		expect(byName.get("stale")!.blockers).toContain("authorisation not recorded (auth_status=pending)");
		expect(byName.get("no-sample")!.ready).toBe(false);
		expect(byName.get("no-sample")!.blockers).toContain("offline profile needs an explicit sample");
	});

	it("opens the gate again once the offline sample is written back", async () => {
		const port = memoryPort({
			"/work/cases/with-sample/scope.md": scopeMarkdown(
				brief({ name: "with-sample", networkProfile: "offline", sample: "samples/app.apk" }),
			),
		});
		const scan = await scanCases(port, "/work");
		expect(scan.cases[0]!.ready).toBe(true);
		expect(scan.cases[0]!.sample).toBe("samples/app.apk");
	});

	it("keeps the gate shut when the written token is not one it knows", async () => {
		// 手写的 scope.md 可能写了不存在的词。未知状态不能因为「不等于 pending」就放行，
		// 未知网络姿态也不能因为「不等于 offline」就跳过判据。
		const bogusAuth = scopeMarkdown(brief({ name: "bogus-auth" })).replace("- status: granted", "- status: yes");
		const bogusProfile = scopeMarkdown(brief({ name: "bogus-profile" })).replace(
			"- mode: authorized_target_only",
			"- mode: lan",
		);
		const scan = await scanCases(
			memoryPort({
				"/work/cases/bogus-auth/scope.md": bogusAuth,
				"/work/cases/bogus-profile/scope.md": bogusProfile,
			}),
			"/work",
		);
		const byName = new Map(scan.cases.map(record => [record.name, record]));
		expect(byName.get("bogus-auth")!.ready).toBe(false);
		expect(byName.get("bogus-profile")!.ready).toBe(false);
		expect(byName.get("bogus-profile")!.blockers).toContain("network profile not recognised (profile=lan)");
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
		ready: true,
		blockers: [],
		inScope: ["app.apk"],
		outOfScope: [],
		deliverables: ["report/report.md"],
		workItems: [{ id: "WI-001", title: "Baseline", target: "app.apk", surface: "android", status: "done" }],
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

	it("ranks ready cases first on a tie and honours readyOnly", () => {
		const pool = [record("blocked", { ready: false, blockers: ["authorisation not recorded"] }), record("ready")];
		expect(rankCases(pool, "").map(hit => hit.record.name)).toEqual(["ready", "blocked"]);
		expect(rankCases(pool, "", { readyOnly: true }).map(hit => hit.record.name)).toEqual(["ready"]);
		expect(rankCases(pool, "", { limit: 1 })).toHaveLength(1);
	});
});

describe("renderCaseIndex", () => {
	it("states the gate, the blockers and the next file to read", () => {
		const scan = { root: "/work", cases: [record("alpha")], truncated: 0 };
		const text = renderCaseIndex(scan, rankCases(scan.cases, ""));
		expect(text).toContain("Case index — /work (1 case, 1 ready)");
		expect(text).toContain("### alpha — ready for act");
		expect(text).toContain("- next: read /work/cases/alpha/scope.md then /work/cases/alpha/workitems.md");
	});

	it("says so when a query matches nothing", () => {
		const scan = { root: "/work", cases: [record("alpha")], truncated: 0 };
		const text = renderCaseIndex(scan, [], "nosuchthing");
		expect(text).toContain('No case matches "nosuchthing".');
	});

	it("explains an empty ready_only listing without inventing a query", () => {
		// ready_only=true 且没有案例就绪时 hits 为空，但调用方**并没有传 query**；
		// 报 'No case matches "undefined"' 等于把内部变量泄成用户可见的句子。
		const blocked = record("alpha", { ready: false, blockers: ["authorisation not recorded"] });
		const scan = { root: "/work", cases: [blocked], truncated: 0 };
		const text = renderCaseIndex(scan, rankCases(scan.cases, undefined, { readyOnly: true }));
		expect(text).not.toContain("undefined");
		expect(text).toContain("No case is ready for act yet.");
	});

	it("surfaces truncation and the blocker list", () => {
		const blocked = record("blocked", { ready: false, blockers: ["no in-scope assets declared"] });
		const text = renderCaseIndex({ root: "/work", cases: [blocked], truncated: 7 }, rankCases([blocked], ""));
		expect(text).toContain("- blockers: no in-scope assets declared");
		expect(text).toContain("Truncated: 7 more case directories were not read.");
	});
});
