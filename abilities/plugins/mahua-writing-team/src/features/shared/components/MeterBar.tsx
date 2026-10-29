interface MeterBarProps {
	/** 0–100，越界会被夹紧；NaN 当 0，界面不会因为一条脏数据整片空掉。 */
	value: number;
	/** 底色之上的那一小截：默认强调色，`muted` 用于「只是比例」，`danger` 用于逾期一类。 */
	tone?: "primary" | "muted" | "destructive";
	className?: string;
}

const FILL: Record<NonNullable<MeterBarProps["tone"]>, string> = {
	primary: "bg-primary",
	muted: "bg-foreground/50",
	destructive: "bg-destructive",
};

/**
 * 一条 3–4px 的进度／比例条。设计稿里它出现在书架卡、书库台账行、弧进度上，
 * 三处的高度和圆角完全一样，所以只留一个实现：换厚度就传 `className`。
 */
export function MeterBar({ value, tone = "primary", className = "h-1" }: MeterBarProps) {
	const bounded = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
	return (
		<div
			role="progressbar"
			aria-valuenow={bounded}
			aria-valuemin={0}
			aria-valuemax={100}
			className={`w-full overflow-hidden rounded-full bg-muted ${className}`}
		>
			<div className={`h-full rounded-full ${FILL[tone]}`} style={{ width: `${bounded}%` }} />
		</div>
	);
}
