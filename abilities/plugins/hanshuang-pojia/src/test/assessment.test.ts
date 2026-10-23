import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { assessmentFileName, renderAssessment } from "../domain/report/assessment";
import { registerWriteAssessmentTool } from "../tools/write-assessment-report";

/** Only the four host calls this tool touches; writes are recorded, not persisted. */
function fakeContext(cwd: string | null, existing: string[] = []) {
	const files = new Map<string, string>();
	const dirs: string[] = [];
	const registered: { id: string; run: (input: Record<string, unknown>) => Promise<string> }[] = [];

	const fs = {
		stat: async (filePath: string) => (existing.includes(filePath) ? { size: 1 } : files.has(filePath) ? { size: 1 } : null),
		createDirectory: async (filePath: string) => {
			dirs.push(filePath);
		},
		writeFile: async (filePath: string, content: string) => {
			files.set(filePath, content);
		},
	};

	const ctx = {
		agent: {
			registerTool: (definition: { id: string; handler: (context: never) => unknown }): Disposable => {
				registered.push({
					id: definition.id,
					run: input =>
						definition.handler({ trigger: { input }, host: { fs }, session: { cwd } } as never) as Promise<string>,
				});
				return { dispose: () => undefined };
			},
		},
		host: { fs },
		session: { cwd },
	} as unknown as PluginContext;

	registerWriteAssessmentTool(ctx);
	const call = (input: Record<string, unknown>) => registered[0].run(input);
	return { call, files, dirs };
}

describe("assessment rendering", () => {
	it("names the file after the sanitised target, never a path", () => {
		expect(assessmentFileName("com.example.app")).toBe("com.example.app_security_assessment_report.md");
		expect(assessmentFileName("../../etc/passwd")).toBe("etc_passwd_security_assessment_report.md");
		expect(() => assessmentFileName("///")).toThrow(/empty after sanitising/);
	});

	it("never invents a finding for a section that was not supplied", () => {
		const { content } = renderAssessment({ target: "demo.exe", language: "en", date: "2026-01-01" });
		expect(content).toContain("Not supplied");
		expect(content).not.toContain("TEST EAX");
		expect(content).not.toContain("patches/");
		expect(content).not.toMatch(/CWE-602/);
		expect(content).toContain("does not invent conclusions");
	});

	it("carries the supplied material into the four sections", () => {
		const { content, emptySections } = renderAssessment({
			target: "demo.exe",
			vulnType: "CWE-602",
			branchLocation: "sub_401000+0x2a",
			description: "the local flag decides the grant",
			pocSummary: "see exports/finding.md",
			defense: "verify server-side",
			language: "en",
			date: "2026-01-02",
		});
		expect(emptySections).toEqual([]);
		expect(content).toContain("sub_401000+0x2a");
		expect(content).toContain("see exports/finding.md");
		expect(content).toContain("verify server-side");
		expect(content).toContain("2026-01-02");
	});

	it("labels generic remediation as generic when none was supplied", () => {
		const { content, emptySections } = renderAssessment({
			target: "demo.exe",
			description: "observed",
			language: "en",
			date: "2026-01-02",
		});
		expect(content).toContain("generic defence-in-depth directions, not a finding");
		expect(emptySections).toContain("## 2. Decision point");
		expect(emptySections).toContain("## 3. Verification evidence");
		expect(emptySections).toContain("## 4. Defence in depth and remediation");
	});

	it("renders the Chinese report when asked", () => {
		const { content } = renderAssessment({ target: "样本", language: "zh", date: "2026-01-02" });
		expect(content).toContain("软件安全评估与脆弱性走查报告");
		expect(content).toContain("未提供");
		expect(content).not.toContain("patches");
	});
});

describe("write_assessment_report", () => {
	it("writes reports/<target>_security_assessment_report.md under the working directory", async () => {
		const { call, files, dirs } = fakeContext("/work/case-1");
		const output = await call({ target: "demo.apk", summary: "observed weakness" });
		const path = "/work/case-1/reports/demo.apk_security_assessment_report.md";
		expect(dirs).toContain("/work/case-1/reports");
		expect(files.get(path)).toContain("observed weakness");
		expect(output).toContain(path);
		expect(output).toContain("not supplied");
	});

	it("refuses to overwrite an existing report unless asked", async () => {
		const path = "/work/case-1/reports/demo.apk_security_assessment_report.md";
		const { call, files } = fakeContext("/work/case-1", [path]);
		const refusal = await call({ target: "demo.apk" });
		expect(refusal).toContain("already exists");
		expect(files.size).toBe(0);
		await call({ target: "demo.apk", overwrite: true });
		expect(files.get(path)).toBeDefined();
	});

	it("rejects a case_dir that escapes the project", async () => {
		const { call, files } = fakeContext("/work/case-1");
		const output = await call({ target: "demo.apk", case_dir: "../../etc" });
		expect(output).toContain("must stay inside the open project");
		expect(files.size).toBe(0);
	});

	it("accepts a case directory inside the project", async () => {
		const { call, files } = fakeContext("/work");
		await call({ target: "demo.apk", case_dir: "cases/acme" });
		expect([...files.keys()]).toEqual(["/work/cases/acme/reports/demo.apk_security_assessment_report.md"]);
	});

	it("asks for the target instead of writing an unnamed report", async () => {
		const { call, files } = fakeContext("/work");
		const output = await call({ target: "  " });
		expect(output).toContain("empty after sanitising");
		expect(files.size).toBe(0);
	});
});
