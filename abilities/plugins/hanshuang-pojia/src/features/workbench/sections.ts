import type { TriageReport } from "../../domain/report/report";

/** 报告里按 id 找 section 的行；缺失时返回空表，页面不必重复判空。 */
export function sectionRows(report: TriageReport | null, id: string): { label: string; value: string }[] {
	return report?.sections.find(section => section.id === id)?.rows ?? [];
}

/** 清单事实里的一个值；用于页面顶部的少量派生数字。 */
export function factValue(report: TriageReport | null, label: string): string | null {
	return report?.facts.find(fact => fact.label === label)?.value ?? null;
}
