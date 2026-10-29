interface ScoreBarProps {
	/** 维度名，已经是当前语言的文案（调用方从 `dimension.*` 取）。 */
	label: string;
	/** 0–100。 */
	value: number;
	/** 及格线：设计稿是 72，评审规则改了这里跟着改。 */
	pass?: number;
}

/**
 * 七维评审的一根条（ADR 0026 §4）：名称 / 条 / 及格刻度 / 数值。
 *
 * 设计稿在「低于及格线 6 分」时把条染成危险色，其余用墨色——宿主没有「墨色条」这个概念，
 * 用 `foreground/60` 表达「正常但不需要强调」，危险色留给真的没过线的维度。
 * 及格刻度是一根 1px 竖线，落在 `pass` 位置，不依赖背景色差。
 */
export function ScoreBar({ label, value, pass = 72 }: ScoreBarProps) {
	const weak = value < pass - 6;
	const bounded = Math.min(100, Math.max(0, Math.round(value)));
	return (
		<div className="flex items-center gap-2">
			<span className="w-10 shrink-0 truncate text-xs text-muted-foreground" title={label}>
				{label}
			</span>
			<div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
				<div
					className={`h-full rounded-full ${weak ? "bg-destructive" : "bg-foreground/60"}`}
					style={{ width: `${bounded}%` }}
				/>
				<span
					aria-hidden="true"
					className="absolute -inset-y-0.5 w-px bg-border"
					style={{ left: `${pass}%` }}
				/>
			</div>
			<span className="w-6 shrink-0 text-right text-xs tabular-nums text-foreground">{bounded}</span>
		</div>
	);
}
