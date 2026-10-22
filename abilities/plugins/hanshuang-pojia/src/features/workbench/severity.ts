import type { Severity } from "../../domain/audit/rules";
import type { TagTone } from "./components/shell/tag";

/** 五级严重度到颜色的唯一映射；页面与行组件都读这里，避免各写一份。 */
export const SEVERITY_TONE: Record<Severity, TagTone> = {
	critical: "high",
	high: "high",
	medium: "medium",
	low: "low",
	info: "neutral",
};

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

export function severityTone(severity: Severity): TagTone {
	return SEVERITY_TONE[severity];
}
