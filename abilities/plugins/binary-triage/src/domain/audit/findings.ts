import { ruleFor, SEVERITY_WEIGHT, severityRank, type Severity } from "./rules";

export interface Finding {
	ruleId: string;
	severity: Severity;
	title: string;
	detail: string;
	evidence: string[];
}

export function finding(ruleId: string, detail: string, evidence: readonly string[] = []): Finding {
	const rule = ruleFor(ruleId);
	return { ruleId, severity: rule.severity, title: rule.title, detail, evidence: evidence.slice(0, 12) };
}

/** 同一规则只出一条：把多个实例的证据并到一条里，避免「12 个导出组件」刷满报告。 */
export function dedupeFindings(findings: readonly Finding[], maxEvidence = 8): Finding[] {
	const merged = new Map<string, Finding>();
	for (const item of findings) {
		const existing = merged.get(item.ruleId);
		if (!existing) {
			merged.set(item.ruleId, { ...item, evidence: item.evidence.slice(0, maxEvidence) });
			continue;
		}
		if (severityRank(item.severity) < severityRank(existing.severity)) existing.severity = item.severity;
		for (const evidence of item.evidence) {
			if (existing.evidence.length >= maxEvidence) break;
			if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence);
		}
	}
	return Array.from(merged.values()).sort((left, right) => {
		const delta = severityRank(left.severity) - severityRank(right.severity);
		return delta !== 0 ? delta : left.ruleId.localeCompare(right.ruleId);
	});
}

export function scoreFindings(findings: readonly Finding[]): number {
	const byRule = new Map<string, Severity>();
	for (const item of findings) {
		const current = byRule.get(item.ruleId);
		if (!current || severityRank(item.severity) < severityRank(current)) byRule.set(item.ruleId, item.severity);
	}
	let total = 0;
	for (const severity of byRule.values()) total += SEVERITY_WEIGHT[severity];
	return Math.min(100, total);
}
