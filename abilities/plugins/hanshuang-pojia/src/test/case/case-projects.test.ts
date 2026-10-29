import { describe, expect, it } from "vitest";
import {
	CASE_PROJECTS,
	DOC_SLOTS,
	capabilityCount,
	caseProjectSlugs,
	findCaseProject,
} from "../../domain/case-projects/catalog";
import { buildCommand, buildScriptFor, buildScriptName, commandsFor } from "../../domain/case-projects/commands";
import { allProjectSlugs, planCaseProject, renderCaseProjectPlan } from "../../domain/case-projects/skeleton";
import { shippedPrecedentSlugs } from "../../domain/case/precedents";

/**
 * 14 条战例工程的形状测试。它盯的是三件容易悄悄退化的事：
 * 缺一条（上游 14 → 包里 13）、跨系统面塌回 Windows、生成物变成不可执行死文件。
 */
describe("case project catalog", () => {
	it("keeps all fourteen upstream archetypes, A to N", () => {
		expect(CASE_PROJECTS.length).toBe(14);
		expect(CASE_PROJECTS.map(project => project.id)).toEqual("ABCDEFGHIJKLMN".split(""));
		expect(new Set(CASE_PROJECTS.map(project => project.slug)).size).toBe(14);
		expect(new Set(allProjectSlugs()).size).toBe(14);
		// 14 条覆盖 14 个不同能力族：重复就说明有一条其实没讲新东西。
		expect(capabilityCount()).toBe(14);
		expect(caseProjectSlugs()).toContain("A=auth-bypass-injection");
		expect(findCaseProject(" n ")?.slug).toBe("vm-protection-layer-recovery");
		expect(findCaseProject("Z")).toBeUndefined();
	});

	it("points every archetype at a shipped precedent", () => {
		const precedents = shippedPrecedentSlugs().split(",").map(slug => slug.trim());
		for (const project of CASE_PROJECTS) {
			expect(precedents).toContain(project.precedent);
		}
	});

	it("gives every archetype a cross-platform surface including Linux", () => {
		for (const project of CASE_PROJECTS) {
			expect(project.platforms).toContain("linux");
			expect(project.platforms).toContain("win32");
			expect(project.languages.length).toBeGreaterThan(0);
			expect(project.toolchain.length).toBeGreaterThan(0);
		}
	});

	it("requires evidence for every phase, in both languages", () => {
		for (const project of CASE_PROJECTS) {
			expect(project.phases.length).toBeGreaterThanOrEqual(4);
			expect(new Set(project.phases.map(phase => phase.id)).size).toBe(project.phases.length);
			for (const phase of project.phases) {
				expect(phase.evidence.en.length).toBeGreaterThan(10);
				expect(phase.evidence.zh.length).toBeGreaterThan(4);
				expect(phase.title.en).not.toBe("");
			}
			// 防御面不能省：这是报告的第 4 节，也是这条战例的价值所在。
			expect(project.phases.map(phase => phase.id)).toContain("defense");
			// 未确认项是硬要求之一，允许个别原型用 defense 收尾但至少要有防御门。
			expect(project.docs.length).toBeGreaterThan(0);
			for (const slot of project.docs) expect(DOC_SLOTS).toContain(slot);
		}
	});
});

describe("case project commands", () => {
	const forbiddenOutsideWindows = [/powershell/i, /\.ps1\b/i, /certutil/i, /Get-Command/i, /Get-FileHash/i];
	const forbiddenEverywhere = [/sudo\b/, /\bcurl\b/, /\bwget\b/, /rm\s+-rf/, /Invoke-WebRequest/i];

	it("never emits a Windows-only command on darwin or linux", () => {
		for (const project of CASE_PROJECTS) {
			for (const os of ["darwin", "linux"] as const) {
				const text = commandsFor(project, os)
					.map(entry => entry.command)
					.join("\n");
				for (const pattern of forbiddenOutsideWindows) expect(text).not.toMatch(pattern);
			}
		}
	});

	it("never elevates, downloads or recursively deletes", () => {
		for (const project of CASE_PROJECTS) {
			for (const os of ["win32", "darwin", "linux"] as const) {
				const text = [...commandsFor(project, os).map(entry => entry.command), buildScriptFor(project, os)].join("\n");
				for (const pattern of forbiddenEverywhere) expect(text).not.toMatch(pattern);
			}
		}
	});

	it("keeps the same five steps on every platform, ending with rollback", () => {
		for (const project of CASE_PROJECTS) {
			for (const os of ["win32", "darwin", "linux"] as const) {
				const commands = commandsFor(project, os);
				expect(commands.map(entry => entry.id)).toEqual(["probe", "build", "selftest", "checksums", "rollback"]);
				expect(commands.every(entry => entry.command.trim().length > 0)).toBe(true);
				expect(commands.at(-1)!.command).toContain("original.bin");
			}
		}
	});

	it("selects the build script the platform can actually run", () => {
		expect(buildScriptName("win32")).toBe("build.ps1");
		expect(buildScriptName("linux")).toBe("build.sh");
		expect(buildScriptName("darwin")).toBe("build.sh");

		const sh = buildScriptFor(CASE_PROJECTS[0]!, "linux");
		expect(sh.startsWith("#!/usr/bin/env bash")).toBe(true);
		expect(sh).toContain("set -euo pipefail");
		expect(sh).toContain("command -v");
		expect(sh).toContain("SHA256SUMS.txt");

		const ps1 = buildScriptFor(CASE_PROJECTS[0]!, "win32");
		expect(ps1).toContain('$ErrorActionPreference = "Stop"');
		expect(ps1).toContain("Get-FileHash");
	});

	it("builds with a real toolchain command for every declared language", () => {
		const languages = new Set(CASE_PROJECTS.flatMap(project => project.languages));
		for (const language of languages) {
			for (const os of ["win32", "darwin", "linux"] as const) {
				const command = buildCommand(language, "demo", os);
				expect(command.length).toBeGreaterThan(8);
				expect(command).not.toMatch(/TODO|unknown/i);
			}
		}
		// POSIX 构建不能带 Windows 路径分隔符，否则在 Linux 上必然失败。
		for (const language of languages) {
			expect(buildCommand(language, "demo", "linux")).not.toContain("\\");
		}
	});
});

describe("case project skeleton", () => {
	it("lays down the upstream contract: readme, two method docs, src, tools, build script", () => {
		for (const project of CASE_PROJECTS) {
			const plan = planCaseProject(project, { os: "linux", cwd: "/work" });
			const paths = plan.files.map(file => file.path);
			expect(paths).toContain("README.md");
			expect(paths).toContain("docs/reverse-engineering.md");
			expect(paths).toContain("docs/algorithm.md");
			expect(paths).toContain("src/README.md");
			expect(paths).toContain("tools/README.md");
			expect(paths).toContain("build.sh");
			expect(new Set(paths).size).toBe(paths.length);
			for (const file of plan.files) expect(file.content.length).toBeGreaterThan(120);
		}
	});

	it("is bilingual and carries the authorisation boundary", () => {
		const plan = planCaseProject(CASE_PROJECTS[0]!, { os: "linux" });
		const readme = plan.files.find(file => file.path === "README.md")!.content;
		expect(readme).toContain("[EN]");
		expect(readme).toContain("[ZH]");
		expect(readme).toContain("Authorisation");
		expect(readme).toContain("auth.status=pending");
		expect(readme).toContain("Rollback");
		// 证据门逐条列出：写不出证据的阶段等于没做。
		for (const phase of CASE_PROJECTS[0]!.phases) expect(readme).toContain(phase.id);
	});

	it("never promises a runnable implementation it did not ship", () => {
		for (const project of CASE_PROJECTS) {
			const plan = planCaseProject(project, { os: "linux" });
			const src = plan.files.find(file => file.path === "src/README.md")!.content;
			expect(src).toContain("故意是空的");
		}
	});

	it("produces no Windows-only file on POSIX, and no absolute path anywhere", () => {
		for (const project of CASE_PROJECTS) {
			for (const os of ["darwin", "linux", "win32"] as const) {
				const plan = planCaseProject(project, { os, cwd: "/work" });
				const paths = plan.files.map(file => file.path);
				expect(paths.some(path => path.endsWith(".ps1"))).toBe(os === "win32");
				for (const path of paths) {
					expect(path.startsWith("/")).toBe(false);
					expect(path.includes("..")).toBe(false);
				}
			}
		}
	});

	it("is deterministic, so a plan can be quoted in a report", () => {
		const a = planCaseProject(CASE_PROJECTS[3]!, { os: "linux", cwd: "/work" });
		const b = planCaseProject(CASE_PROJECTS[3]!, { os: "linux", cwd: "/work" });
		expect(a).toEqual(b);
		expect(renderCaseProjectPlan(a, a.files.map(file => file.path), [])).toBe(
			renderCaseProjectPlan(b, b.files.map(file => file.path), []),
		);
	});

	it("renders a plan that says what it did not do", () => {
		const plan = planCaseProject(CASE_PROJECTS[0]!, { os: "linux", cwd: "/work" });
		const text = renderCaseProjectPlan(plan, ["README.md"], ["build.sh"]);
		expect(text).toContain("directory: /work/");
		expect(text).toContain("left alone (1");
		expect(text).toContain("nothing was executed and no sample was read");
		expect(text).toContain("src/ is intentionally empty");
	});
});

/**
 * 工具层的接线测试：`scaffold_case` 加了 `project` 分支之后，必须能真的把骨架写下去，
 * 且第二次运行不会静默覆盖操作者已经写过的东西。
 */
function memoryHarness() {
	const files = new Map<string, string>();
	const fs = {
		readDir: async (path: string) => {
			const base = path.replace(/\/+$/, "");
			const hits = [...files.keys()].filter(key => key.startsWith(`${base}/`));
			if (hits.length === 0) throw new Error(`ENOENT ${path}`);
			return hits;
		},
		readFile: async (path: string) => ({ content: files.get(path) ?? "", encoding: "utf8" as const }),
		writeFile: async (path: string, content: string) => {
			files.set(path, content);
		},
		createDirectory: async () => undefined,
		stat: async (path: string) => (files.has(path) ? { size: files.get(path)!.length, modifiedAt: 0, createdAt: 0 } : null),
	};
	const registered: { id: string; run: (input: Record<string, unknown>) => Promise<string> }[] = [];
	const ctx = {
		agent: {
			registerTool: (definition: { id: string; handler: (context: never) => unknown }) => {
				registered.push({
					id: definition.id,
					run: input =>
						definition.handler({ trigger: { input }, host: { fs }, session: { cwd: "/work" } } as never) as Promise<string>,
				});
				return { dispose: () => undefined };
			},
		},
		host: { fs },
		session: { cwd: "/work" },
	} as never;
	return { ctx, files, registered };
}

describe("scaffold_case project mode", () => {
	it("writes the archetype skeleton and reports the next commands", async () => {
		const { registerScaffoldCaseTool } = await import("../../tools/case/scaffold-case");
		const { ctx, files, registered } = memoryHarness();
		registerScaffoldCaseTool(ctx);
		const run = registered[0]!.run;

		const text = await run({ project: "a", os: "linux" });
		expect(text).toContain("# case project A — auth-bypass-injection");
		expect(text).toContain("directory: /work/auth-bypass-injection");
		expect(files.has("/work/auth-bypass-injection/README.md")).toBe(true);
		expect(files.has("/work/auth-bypass-injection/docs/reverse-engineering.md")).toBe(true);
		expect(files.has("/work/auth-bypass-injection/build.sh")).toBe(true);
		expect(files.has("/work/auth-bypass-injection/build.ps1")).toBe(false);

		// 第二次不覆盖：已存在的文件被报告为 left alone，内容不动。
		const before = files.get("/work/auth-bypass-injection/README.md");
		const again = await run({ project: "A", os: "linux" });
		expect(again).toContain("left alone (");
		expect(files.get("/work/auth-bypass-injection/README.md")).toBe(before);
	});

	it("honours the requested OS and refuses to leave the project", async () => {
		const { registerScaffoldCaseTool } = await import("../../tools/case/scaffold-case");
		const { ctx, files, registered } = memoryHarness();
		registerScaffoldCaseTool(ctx);
		const run = registered[0]!.run;

		await run({ project: "N", os: "win32" });
		expect(files.has("/work/vm-protection-layer-recovery/build.ps1")).toBe(true);

		const refused = await run({ project: "N", into: "/etc/evil" });
		expect(refused).toContain("inside the open project");
	});

	it("names the available archetypes when the letter is wrong", async () => {
		const { registerScaffoldCaseTool } = await import("../../tools/case/scaffold-case");
		const { ctx, registered } = memoryHarness();
		registerScaffoldCaseTool(ctx);
		const text = await registered[0]!.run({ project: "Q" });
		expect(text).toContain("No case project is named");
		expect(text).toContain("A=auth-bypass-injection");
	});
});
