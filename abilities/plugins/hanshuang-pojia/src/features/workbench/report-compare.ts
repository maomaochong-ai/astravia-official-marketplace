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

/**
 * 家族基线（G3）：当前样本 vs 家族内其它样本的聚合，输出三列归属。
 *
 * 「家族」没有全局 shape 指纹，所以这里以共享的清单事实为锚：把 family 里每份报告的
 * 发现规则集与事实表归并，得出三列——
 * - common      当前样本与家族都观察到
 * - left-only   仅当前样本有
 * - family-only 家族有而当前样本没有
 * 对每个发现规则给出它在家族内出现的次数，方便判断这是样本独有还是家族通病。
 * 纯静态聚合，不重读样本字节。
 */
export interface FamilyFinding {
	ruleId: string;
	title: string;
	severity: Severity;
	side: "common" | "left-only" | "family-only";
	/** 家族（不含当前样本）内出现该规则的报告份数。 */
	familyCount: number;
}

export interface FamilyBaseline {
	leftName: string;
	/** family 的大小（不含当前样本）。0 表示没有可比对对象。 */
	familySize: number;
	score: { left: number; familyAvg: number; familyMax: number };
	facts: Array<{ label: string; left: string; family: string; changed: boolean }>;
	findings: FamilyFinding[];
	commonFindings: number;
	leftOnlyFindings: number;
	familyOnlyFindings: number;
}

export function familyBaseline(left: TriageReport, family: readonly TriageReport[]): FamilyBaseline {
	const leftRules = new Set(left.findings.map(finding => finding.ruleId));
	const familyRules: Map<string, number> = new Map();
	for (const member of family) {
		for (const finding of member.findings) {
			familyRules.set(finding.ruleId, (familyRules.get(finding.ruleId) ?? 0) + 1);
		}
	}

	const seen = new Set<string>();
	const findings: FamilyFinding[] = [];
	for (const finding of left.findings) {
		if (seen.has(finding.ruleId)) continue;
		seen.add(finding.ruleId);
		const familyCount = familyRules.get(finding.ruleId) ?? 0;
		findings.push({
			ruleId: finding.ruleId,
			title: finding.title,
			severity: finding.severity,
			side: familyCount > 0 ? "common" : "left-only",
			familyCount,
		});
	}
	for (const [ruleId, count] of familyRules) {
		if (leftRules.has(ruleId) || seen.has(ruleId)) continue;
		const sample = family.find(report => report.findings.some(f => f.ruleId === ruleId));
		seen.add(ruleId);
		findings.push({
			ruleId,
			title: sample?.findings.find(f => f.ruleId === ruleId)?.title ?? ruleId,
			severity: sample?.findings.find(f => f.ruleId === ruleId)?.severity ?? ("info" as Severity),
			side: "family-only",
			familyCount: count,
		});
	}

	const familyScores = family.map(member => member.risk.score);
	const familyAvg = familyScores.length ? familyScores.reduce((sum, score) => sum + score, 0) / familyScores.length : left.risk.score;
	const familyMax = familyScores.length ? Math.max(...familyScores) : left.risk.score;

	const leftFacts = factMap(left);
	const familyFactValues = new Map<string, string[]>();
	for (const member of family) {
		for (const fact of member.facts) {
			const bucket = familyFactValues.get(fact.label) ?? [];
			bucket.push(fact.value);
			familyFactValues.set(fact.label, bucket);
		}
	}
	const labels = new Set([...leftFacts.keys(), ...familyFactValues.keys()]);
	const facts: FamilyBaseline["facts"] = [];
	for (const label of labels) {
		const leftValue = leftFacts.get(label) ?? "—";
		const familyValues = familyFactValues.get(label) ?? [];
		const familyValue = familyValues.length ? mostCommon(familyValues) : "—";
		facts.push({ label, left: leftValue, family: familyValue, changed: leftValue !== familyValue });
	}
	facts.sort((a, b) => Number(b.changed) - Number(a.changed) || a.label.localeCompare(b.label));

	const commonFindings = findings.filter(f => f.side === "common").length;
	const leftOnlyFindings = findings.filter(f => f.side === "left-only").length;
	const familyOnlyFindings = findings.filter(f => f.side === "family-only").length;

	return {
		leftName: left.target.name,
		familySize: family.length,
		score: { left: left.risk.score, familyAvg, familyMax },
		facts,
		findings,
		commonFindings,
		leftOnlyFindings,
		familyOnlyFindings,
	};
}

function mostCommon(values: readonly string[]): string {
	const counts = new Map<string, number>();
	let best = "";
	let bestCount = 0;
	for (const value of values) {
		const next = (counts.get(value) ?? 0) + 1;
		counts.set(value, next);
		if (next > bestCount) {
			bestCount = next;
			best = value;
		}
	}
	return best;
}