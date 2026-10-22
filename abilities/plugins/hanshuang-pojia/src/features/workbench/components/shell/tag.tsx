import type { ReactNode } from "react";

export type TagTone = "neutral" | "high" | "medium" | "low" | "purple";

const TONE: Record<TagTone, string> = {
	neutral: "bg-surface-chip text-text-3",
	high: "bg-risk-high/12 text-risk-high",
	medium: "bg-risk-medium/12 text-risk-medium",
	low: "bg-risk-low/12 text-risk-low",
	purple: "bg-purple/12 text-purple",
};

export interface TagProps {
	tone?: TagTone;
	children: ReactNode;
	className?: string;
}

/** 格式、来源、方案之类的小标签。 */
export function Tag({ tone = "neutral", children, className }: TagProps) {
	return <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${TONE[tone]} ${className ?? ""}`}>{children}</span>;
}
