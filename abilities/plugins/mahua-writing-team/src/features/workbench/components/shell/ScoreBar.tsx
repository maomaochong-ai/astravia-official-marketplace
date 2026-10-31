/**
 * 一维评审分：墨条的长度就是分数，右侧竖线是及格线（默认 72）。
 * 低于及格线 6 分才换颜色——刚压线不报警，差得明显才提醒。
 */
export function ScoreBar({ label, value, pass = 72 }: { label: string; value: number; pass?: number }) {
	const weak = value < pass - 6;
	return (
		<div className="flex items-center gap-2.5">
			<span className="w-[5.5rem] shrink-0 truncate text-micro text-ink-soft">{label}</span>
			<div className="relative h-[5px] flex-1 overflow-hidden rounded-pill bg-inset">
				<div
					className={`h-full rounded-pill ${weak ? "bg-fail" : "bg-ink"}`}
					style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
				/>
				<span className="absolute top-[-2px] h-[9px] w-px bg-line-strong" style={{ left: `${pass}%` }} />
			</div>
			<span className="w-6 shrink-0 text-right font-mono text-micro tabular-nums text-ink">{value}</span>
		</div>
	);
}
