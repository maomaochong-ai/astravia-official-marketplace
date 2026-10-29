/**
 * 严重级别的显示映射：圆点颜色与文字色。
 *
 * 只放映射，不放判定。级别的来源永远在 `domain/audit/rules.ts`；
 * 这里加一个键就够，不要在页面里写 `severity === "critical" ? ...`。
 */

import type { Severity } from "../../domain/audit/rules";


export const SEVERITY_DOT: Record<Severity, string> = {
	critical: "bg-risk-high",
	high: "bg-risk-high",
	medium: "bg-risk-medium",
	low: "bg-risk-low",
	info: "bg-text-4",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
	critical: "text-risk-high",
	high: "text-risk-high",
	medium: "text-risk-medium",
	low: "text-risk-low",
	info: "text-text-4",
};

