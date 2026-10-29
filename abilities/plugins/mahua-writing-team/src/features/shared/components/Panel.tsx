import type { ReactNode } from "react";

interface PanelProps {
	/** 面板名：给一层纸起名，不是页面标题。空着就只画边框。 */
	title?: string;
	/** 标题右边的一行事实（数量、范围、更新时间），不参与排版对齐。 */
	meta?: string;
	/** 右端操作区，通常是一两个小按钮。 */
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	/** 内容区留白交给调用者：表格要贴边，段落要留 pad。 */
	bodyClassName?: string;
}

/**
 * 一张浮纸（ADR 0026）：设计稿里「纸上再压一张纸」的那一层。
 *
 * 圆角、描边、可选标题行都收在这里，内容排版留给调用者——否则十处面板会各写一套边框，
 * 迟早有一处偷偷加深底色，把宿主主题切换弄花。底色只用 `bg-card`，纸面由根节点的
 * `bg-background` 提供，两者之差就是设计稿的「明度阶梯」。
 */
export function Panel({
	title,
	meta,
	actions,
	children,
	className = "",
	bodyClassName = "px-4 py-3",
}: PanelProps) {
	const headed = title !== undefined || meta !== undefined || actions !== undefined;
	return (
		<section className={`min-w-0 rounded-xl border border-border/60 bg-card ${className}`}>
			{headed ? (
				<header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/40 px-4 py-2.5">
					{title !== undefined ? (
						<h2 className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
							{title}
						</h2>
					) : null}
					{meta !== undefined ? (
						<span className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">{meta}</span>
					) : null}
					{actions !== undefined ? (
						<div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
					) : null}
				</header>
			) : null}
			<div className={bodyClassName}>{children}</div>
		</section>
	);
}
