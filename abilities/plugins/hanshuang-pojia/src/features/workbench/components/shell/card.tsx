import type { ReactNode } from "react";

export interface CardProps {
	title?: string;
	/** 标题右侧的操作区（筛选、按钮）。 */
	actions?: ReactNode;
	className?: string;
	bodyClassName?: string;
	children: ReactNode;
}

/** 面板里所有内容块的外框：靠底色分层，只留一层几乎看不见的描边；不再叠加阴影。 */
export function Card({ title, actions, className, bodyClassName, children }: CardProps) {
	return (
		<section className={`min-w-0 rounded-xl bg-surface-2 ring-1 ring-line-subtle ${className ?? ""}`}>
			{title ? (
				<header className="flex items-center gap-2 border-b border-line-subtle px-3.5 py-2.5">
					<h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{title}</h2>
					{actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
				</header>
			) : null}
			<div className={bodyClassName}>{children}</div>
		</section>
	);
}
