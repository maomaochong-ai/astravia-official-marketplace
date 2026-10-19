import { scoreFindings, dedupeFindings, type Finding } from "../audit/findings";
import { gradeFor, ruleFor, type Severity } from "../audit/rules";

export type ReportMode = "summary" | "full";

export interface ReportTarget {
	path: string;
	name: string;
	size: number;
	sha256: string;
	format: string;
	formatLabel: string;
	generatedAt: string;
}

export interface ReportRow {
	label: string;
	value: string;
}

export interface ReportSection {
	id: string;
	title: string;
	rows: ReportRow[];
	/** 两列表格。rows 的 label / value 分别是第一、二列。 */
	columns: [string, string];
}

export interface RiskSummary {
	score: number;
	grade: "A" | "B" | "C" | "D" | "E";
	drivers: { ruleId: string; severity: Severity; title: string }[];
}

export interface TriageReport {
	schemaVersion: 1;
	mode: ReportMode;
	target: ReportTarget;
	risk: RiskSummary;
	summary: string[];
	findings: Finding[];
	facts: ReportRow[];
	sections: ReportSection[];
	limits: string[];
}

export interface ReportDraft {
	mode: ReportMode;
	target: ReportTarget;
	findings: readonly Finding[];
	facts: ReportRow[];
	sections: ReportSection[];
	limits: string[];
	summary: string[];
}

const SEVERITY_LABEL: Record<Severity, string> = {
	critical: "critical",
	high: "high",
	medium: "medium",
	low: "low",
	info: "info",
};

export function buildReport(draft: ReportDraft): TriageReport {
	const findings = dedupeFindings(draft.findings);
	const score = scoreFindings(findings);
	const summary = [...draft.summary, ...findings.filter(item => item.severity !== "info").slice(0, 3).map(item => `${SEVERITY_LABEL[item.severity]}: ${item.title}`)].slice(0, 8);
	const drivers = findings
		.filter(item => item.severity !== "info")
		.slice(0, 4)
		.map(item => ({ ruleId: item.ruleId, severity: item.severity, title: item.title }));

	return {
		schemaVersion: 1,
		mode: draft.mode,
		target: draft.target,
		risk: { score, grade: gradeFor(score), drivers },
		summary,

		findings,
		facts: draft.facts,
		sections: draft.sections,
		limits: draft.limits,
	};
}

export function formatBytes(size: number): string {
	if (!Number.isFinite(size) || size < 0) return "0 B";
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
	if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MiB`;
	return `${(size / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

function table(columns: [string, string], rows: readonly ReportRow[]): string {
	const head = `| ${columns[0]} | ${columns[1]} |\n| --- | --- |`;
	const body = rows.map(row => `| ${escapeCell(row.label)} | ${escapeCell(row.value)} |`).join("\n");
	return `${head}\n${body}`;
}

function escapeCell(value: string): string {
	return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const SUMMARY_BUDGET = 4500;
const FULL_BUDGET = 24000;

/** 报告是喂给模型的上下文，必须有硬上限；截断处明确写出来，避免模型以为后面没内容了。 */
export function truncateMarkdown(text: string, budget: number): string {
	if (text.length <= budget) return text;
	const cut = text.slice(0, budget);
	const lastBreak = cut.lastIndexOf("\n");
	return `${lastBreak > budget * 0.6 ? cut.slice(0, lastBreak) : cut}\n\n_(report truncated at the ${budget} character budget; request the full report for the remaining sections)_`;
}

export function renderMarkdown(report: TriageReport, options: { mode?: ReportMode } = {}): string {
	const mode = options.mode ?? report.mode;
	const summary = mode === "summary";
	const lines: string[] = [];

	lines.push(`# Binary triage — ${report.target.name}`);
	lines.push("");
	lines.push(`**Risk ${report.risk.score}/100 · grade ${report.risk.grade} · ${report.target.formatLabel}**`);
	lines.push("");
	lines.push(`- Path: \`${report.target.path}\``);
	lines.push(`- Size: ${formatBytes(report.target.size)}`);
	lines.push(`- SHA-256: \`${report.target.sha256}\``);
	lines.push(`- Analysed: ${report.target.generatedAt}`);
	lines.push("");

	if (report.summary.length > 0) {
		lines.push("## What stands out");
		lines.push("");
		for (const item of report.summary.slice(0, summary ? 5 : 12)) lines.push(`- ${item}`);
		lines.push("");
	}

	if (report.findings.length > 0) {
		lines.push("## Findings");
		lines.push("");
		const findings = summary ? report.findings.slice(0, 6) : report.findings;
		for (const item of findings) {
			lines.push(`### ${SEVERITY_LABEL[item.severity]} · ${item.title}`);
			lines.push("");
			lines.push(item.detail);
			if (item.evidence.length > 0) {
				lines.push("");
				for (const evidence of summary ? item.evidence.slice(0, 3) : item.evidence) lines.push(`- \`${evidence}\``);
			}
			lines.push("");
			lines.push(`_Next step: ${ruleFor(item.ruleId).advice}_`);
			lines.push("");
		}
		if (summary && report.findings.length > findings.length) {
			lines.push(`_${report.findings.length - findings.length} more finding(s) omitted in summary mode._`);
			lines.push("");
		}
	}

	if (report.facts.length > 0) {
		lines.push("## Facts");
		lines.push("");
		lines.push(table(["Field", "Value"], report.facts));
		lines.push("");
	}

	for (const section of report.sections) {
		if (section.rows.length === 0) continue;
		lines.push(`## ${section.title}`);
		lines.push("");
		lines.push(table(section.columns, summary ? section.rows.slice(0, 8) : section.rows));
		lines.push("");
		if (summary && section.rows.length > 8) {
			lines.push(`_${section.rows.length - 8} more row(s) omitted in summary mode._`);
			lines.push("");
		}
	}

	if (report.limits.length > 0) {
		lines.push("## Limits");
		lines.push("");
		for (const limit of report.limits) lines.push(`- ${limit}`);
		lines.push("");
	}

	return truncateMarkdown(lines.join("\n").trimEnd(), summary ? SUMMARY_BUDGET : FULL_BUDGET);
}

export function reportToJson(report: TriageReport): string {
	return `${JSON.stringify(report, null, 2)}\n`;
}
