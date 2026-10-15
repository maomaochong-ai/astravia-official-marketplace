/**
 * 状态芯片 —— 跟宿主规范一致：底色 + 文字色对比。
 * 不直接用纯红/绿/黄填底，而是 `bg-色/15 text-色` 半透明叠文字色，
 * 让底色随宿主主题的 card / muted 透出。
 *
 * 不引入 `@astravia-org/ui/utils`（as-ocr / tihu 都没引），用 className 拼接。
 */

import type { JSX, ReactNode } from "react";

export type StatusTone = "neutral" | "progress" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
	neutral: "bg-muted text-muted-foreground",
	progress: "bg-primary/10 text-primary",
	success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
	danger: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const BASE =
	"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

export interface StatusChipProps {
	readonly tone: StatusTone;
	readonly children: ReactNode;
	readonly className?: string;
	readonly title?: string;
}

export function StatusChip({ tone, children, className, title }: StatusChipProps): JSX.Element {
	const cls = className ? `${BASE} ${TONE_CLASS[tone]} ${className}` : `${BASE} ${TONE_CLASS[tone]}`;
	return (
		<span title={title} className={cls}>
			{children}
		</span>
	);
}
