export type StatTone = "default" | "high" | "medium" | "low";

const TONE_VALUE: Record<StatTone, string> = {
	default: "text-text",
	high: "text-risk-high",
	medium: "text-risk-medium",
	low: "text-risk-low",
};

export interface StatTileProps {
	label: string;
	value: string | number;
	hint?: string;
	tone?: StatTone;
}

/** 一行 3–4 个的统计卡，数字用等宽体保证纵向对齐。 */
export function StatTile({ label, value, hint, tone = "default" }: StatTileProps) {
	return (
		<div className="min-w-0 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
			<div className="truncate text-[11px] text-text-4">{label}</div>
			<div className={`mt-1 truncate font-mono text-[18px] font-semibold leading-none ${TONE_VALUE[tone]}`}>{value}</div>
			{hint ? <div className="mt-1.5 truncate text-[10.5px] text-text-4">{hint}</div> : null}
		</div>
	);
}
