/**
 * 状态芯片 —— 跟宿主规范一致：底色 + 文字色对比。
 * 不直接用纯红/绿/黄填底，而是 `bg-色/15 text-色` 半透明叠文字色，
 * 让底色随宿主主题的 card / muted 透出。
 *
 * 五档 tone 全部指向 style.css 里派生自宿主的语义 token
 * （sage / apricot / danger / primary / mist），因此浅色与深色主题下
 * 都不需要 `dark:` 双写。
 *
 * 不引入 `@astravia-org/ui/utils`（as-ocr / tihu 都没引），用 className 拼接。
 */

import type { JSX, ReactNode } from "react";

export type StatusTone = "neutral" | "progress" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
	neutral: "bg-mist text-muted-foreground",
	progress: "bg-primary/12 text-primary",
	success: "bg-sage-light text-sage-dark",
	warning: "bg-apricot-light text-ochre",
	danger: "bg-danger/12 text-danger",
};

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-micro font-medium";

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
