/**
 * 卡片骨架：设计稿里所有内容块都是同一种卡（surface-2 底 + 1px 边 + 10px 圆角）。
 *
 * 头部固定 `px-4 py-2.5` 且带下边框，正文自己决定是列表（divide-y）还是内边距块，
 * 这样一屏里并排的三张卡头部永远对齐，不会出现一张高一张矮。
 *
 * 面板宽度从 320px 起，卡片一律 `min-w-0`：内容再长也只能在卡内滚动/截断，
 * 不允许把外层栅格撑破（上一版侧边栏与正文交叉就是这个原因）。
 */

import type { JSX, ReactNode } from "react";

interface PanelProps {
	readonly children: ReactNode;
	readonly className?: string;
	readonly as?: "section" | "div";
}

export function Panel({ children, className, as = "section" }: PanelProps): JSX.Element {
	const cls = ["flex min-w-0 flex-col rounded-lg border border-border bg-surface-2", className ?? ""].filter(Boolean).join(" ");
	return as === "section" ? <section className={cls}>{children}</section> : <div className={cls}>{children}</div>;
}

interface PanelHeaderProps {
	readonly title: string;
	/** 标题旁的小计数徽标。 */
	readonly badge?: string | number;
	/** 标题下方的一句话说明。 */
	readonly hint?: string;
	/** 右侧动作区（按钮、分段控件）。 */
	readonly actions?: ReactNode;
	readonly className?: string;
}

export function PanelHeader({ title, badge, hint, actions, className }: PanelHeaderProps): JSX.Element {
	const cls = ["flex min-w-0 items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5", className ?? ""]
		.filter(Boolean)
		.join(" ");
	return (
		<header className={cls}>
			<div className="flex min-w-0 flex-col gap-0.5">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="truncate text-body-sm font-semibold text-text">{title}</h2>
					{badge === undefined ? null : (
						<span className="shrink-0 rounded-full bg-surface-chip px-1.5 py-0.5 text-micro-up tabular-nums text-text-3">{badge}</span>
					)}
				</div>
				{hint === undefined ? null : <p className="truncate text-micro text-text-4">{hint}</p>}
			</div>
			{actions === undefined ? null : <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
		</header>
	);
}

interface PanelBodyProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export function PanelBody({ children, className }: PanelBodyProps): JSX.Element {
	return <div className={["min-w-0 p-4", className ?? ""].filter(Boolean).join(" ")}>{children}</div>;
}
