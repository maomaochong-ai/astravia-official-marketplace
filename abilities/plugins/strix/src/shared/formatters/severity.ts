/**
 * Severity vocabulary and ordering shared by the summary strip and the list.
 *
 * Strix writes severities as free text on findings, so unknown values are kept
 * visible (as `info`) rather than dropped: a finding a user cannot see is worse
 * than one sorted into the wrong bucket.
 */

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

export type Severity = (typeof SEVERITIES)[number];

export function normalizeSeverity(value: unknown): Severity {
	const text = String(value ?? "")
		.trim()
		.toLowerCase();
	if ((SEVERITIES as readonly string[]).includes(text)) return text as Severity;
	if (text.startsWith("crit")) return "critical";
	if (text.startsWith("high") || text.startsWith("imp")) return "high";
	if (text.startsWith("med") || text.startsWith("mod")) return "medium";
	if (text.startsWith("low") || text.startsWith("min")) return "low";
	return "info";
}

export function severityRank(value: unknown): number {
	return SEVERITIES.indexOf(normalizeSeverity(value));
}

export function severityTone(value: unknown): string {
	switch (normalizeSeverity(value)) {
		case "critical":
			return "text-red-600 dark:text-red-400";
		case "high":
			return "text-orange-600 dark:text-orange-400";
		case "medium":
			return "text-amber-600 dark:text-amber-400";
		case "low":
			return "text-sky-600 dark:text-sky-400";
		default:
			return "text-muted-foreground";
	}
}

export function countBySeverity(items: readonly { severity?: unknown }[]): Record<Severity, number> {
	const tally: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
	for (const item of items) tally[normalizeSeverity(item.severity)] += 1;
	return tally;
}

export function sortBySeverity<T extends { severity?: unknown }>(items: readonly T[]): T[] {
	return [...items].sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
}
