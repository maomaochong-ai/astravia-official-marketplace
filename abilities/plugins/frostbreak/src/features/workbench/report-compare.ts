import type { Finding } from "../../domain/audit/findings";
import type { Severity } from "../../domain/audit/rules";
import type { TriageReport } from "../../domain/report/report";

export interface DiffList {
	added: string[];
	removed: string[];
	kept: number;
}

export interface FactDiff {
	label: string;
	left: string;
	right: string;
	changed: boolean;
}

export interface FindingSummary {
	ruleId: string;
	title: string;
	severity: Severity;
}

export interface ReportDiff {
	score: { left: number; right: number; delta: number };
	size: { left: number; right: number };
	facts: FactDiff[];
	permissions: DiffList;
	components: DiffList;
	findings: { added: FindingSummary[]; resolved: FindingSummary[]; kept: number };
}

function sectionLabels(report: TriageReport, id: string): string[] {
	const section = report.sections.find(item => item.id === id);
	return section ? section.rows.map(row => row.label) : [];
}

function diffSets(left: readonly string[], right: readonly string[]): DiffList {
	const before = new Set(left);
	const after = new Set(right);
	return {
		added: right.filter(item => !before.has(item)),
		removed: left.filter(item => !after.has(item)),
		kept: right.filter(item => before.has(item)).length,
	};
}

function factMap(report: TriageReport): Map<string, string> {
	return new Map(report.facts.map(fact => [fact.label, fact.value]));
}

function summarize(finding: Finding): FindingSummary {
	return { ruleId: finding.ruleId, title: finding.title, severity: finding.severity };
}

/**
 * 两个版本的分析结果对比。
 *
 * 只用本次会话里已有的报告（清单事实、权限、组件、发现），不重读字节：
 * 面板能保证的只是「两次静态分析之间变了什么」，不做二进制级差分，
 * 二进制差分在对话里由 diff_binaries 工具完成。
 */
export function compareReports(left: TriageReport, right: TriageReport): ReportDiff {
	const leftFacts = factMap(left);
	const rightFacts = factMap(right);
	const labels = new Set([...leftFacts.keys(), ...rightFacts.keys()]);
	const facts: FactDiff[] = [];
	for (const label of labels) {
		const before = leftFacts.get(label) ?? "—";
		const after = rightFacts.get(label) ?? "—";
		facts.push({ label, left: before, right: after, changed: before !== after });
	}
	facts.sort((a, b) => Number(b.changed) - Number(a.changed) || a.label.localeCompare(b.label));

	const leftRules = new Set(left.findings.map(finding => finding.ruleId));
	const rightRules = new Set(right.findings.map(finding => finding.ruleId));

	return {
		score: { left: left.risk.score, right: right.risk.score, delta: right.risk.score - left.risk.score },
		size: { left: left.target.size, right: right.target.size },
		facts,
		permissions: diffSets(sectionLabels(left, "permissions"), sectionLabels(right, "permissions")),
		components: diffSets(sectionLabels(left, "components"), sectionLabels(right, "components")),
		findings: {
			added: right.findings.filter(finding => !leftRules.has(finding.ruleId)).map(summarize),
			resolved: left.findings.filter(finding => !rightRules.has(finding.ruleId)).map(summarize),
			kept: right.findings.filter(finding => leftRules.has(finding.ruleId)).length,
		},
	};
}
