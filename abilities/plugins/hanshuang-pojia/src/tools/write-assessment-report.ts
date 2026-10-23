import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { isOutsideProject, resolveSamplePath } from "../domain/sample-path";
import { renderAssessment, type AssessmentLanguage } from "../domain/report/assessment";
import { joinPath } from "../domain/toolchain/paths";

interface WriteAssessmentInput {
	target: string;
	case_dir?: string;
	vuln_type?: string;
	branch_location?: string;
	summary?: string;
	evidence?: string;
	remediation?: string;
	language?: AssessmentLanguage;
	overwrite?: boolean;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export function registerWriteAssessmentTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<WriteAssessmentInput>({
		id: "write_assessment_report",
		name: "write_assessment_report",
		label: "%tool.assessment.label%",
		description: [
			"Write the four-section security assessment into a case's reports/ directory:",
			"  1. summary and root cause   2. decision point (function / offset)",
			"  3. verification evidence    4. defence in depth and remediation",
			"",
			"The file is reports/<target>_security_assessment_report.md. Pass only what you actually observed:",
			"a section you leave out renders an explicit 'not supplied' line, never a default finding. In particular",
			"nothing is claimed about the sample unless you supply it, and no example branch snippet is fabricated.",
			"",
			"case_dir defaults to the conversation working directory and must stay inside the open project. The",
			"plugin creates reports/ if missing and never overwrites an existing report unless overwrite=true. Evidence",
			"(decompiler output, disassembly, string dumps, and any patch or rebuilt build you produced) is cited from",
			"exports/ in section 3. For a triage summary of one sample use export_triage_report instead.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				target: { type: "string", description: "Target asset name; also the report file stem." },
				case_dir: { type: "string", description: "Case directory (relative to the project root); defaults to the working directory." },
				vuln_type: { type: "string", description: "Defect class, e.g. 'CWE-602: client-side authorisation'." },
				branch_location: { type: "string", description: "Function / symbol / offset where the decision is made." },
				summary: { type: "string", description: "Section 1: what is weak and why (observed, not assumed)." },
				evidence: { type: "string", description: "Section 3: how it was verified and which exports/ file records it." },
				remediation: { type: "string", description: "Section 4: hardening advice for this finding. Omitted = generic directions only, labelled as such." },
				language: { type: "string", enum: ["zh", "en"], description: "Report language (default en)." },
				overwrite: { type: "boolean", description: "Replace an existing report file (default false)." },
			},
			required: ["target"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			const input = context.trigger.input;
			const cwd = context.session.cwd;
			const rawCase = (input.case_dir ?? "").trim();
			if (rawCase && isOutsideProject(rawCase, cwd)) return `case_dir must stay inside the open project: ${rawCase}`;
			if (!cwd && !rawCase) return "No working directory is available; pass case_dir explicitly.";

			let caseDir: string;
			try {
				caseDir = rawCase ? resolveSamplePath(cwd as string, rawCase) : (cwd as string);
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			let assessment;
			try {
				assessment = renderAssessment({
					target: input.target ?? "",
					vulnType: input.vuln_type,
					branchLocation: input.branch_location,
					description: input.summary,
					pocSummary: input.evidence,
					defense: input.remediation,
					language: input.language === "zh" ? "zh" : "en",
					date: today(),
				});
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			const reportsDir = joinPath(caseDir, "reports");
			const reportPath = joinPath(reportsDir, assessment.fileName);

			try {
				const existing = await context.host.fs.stat(reportPath);
				if (existing && input.overwrite !== true) {
					return [
						`${reportPath} already exists and was left untouched.`,
						"",
						"Pass overwrite=true if this assessment replaces it, or pick another target name.",
					].join("\n");
				}
				await context.host.fs.createDirectory(reportsDir);
				await context.host.fs.writeFile(reportPath, assessment.content);
			} catch (error) {
				return `write_assessment_report failed: ${error instanceof Error ? error.message : String(error)}`;
			}

			const lines = [
				`Wrote ${reportPath}`,
				"",
				`Four sections, ${assessment.content.length} characters.`,
			];
			if (assessment.emptySections.length > 0) {
				lines.push(
					"",
					`Left unsupplied (rendered as 'not supplied', not as a finding): ${assessment.emptySections.join(", ")}.`,
				);
			}
			lines.push(
				"",
				"Keep the evidence it cites under exports/, then hand the file to the user. init_task creates the",
				"surrounding samples/ exports/ reports/ layout if the case directory does not exist yet.",
			);
			return lines.join("\n");
		},
	});
}
