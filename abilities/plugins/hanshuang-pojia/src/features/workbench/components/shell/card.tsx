import type { ReactNode } from "react";

export interface CardProps {
	title?: string;
	/** 标题右侧的操作区（筛选、按钮）。 */
	actions?: ReactNode;
	className?: string;
	bodyClassName?: string;
	/**
	 * 吃掉所在列的剩余高度。
	 *
	 * 页面根是列（`.fb-page`），短内容时它会拉到面板底部；标了 fill 的卡片跟着长，
	 * 卡体自己滚——否则卡片停在内容高度，下面留一条底色空白。
	 */
	fill?: boolean;
	children: ReactNode;
}

/**
 * 面板里所有内容块的外框：靠底色分层，只留一层几乎看不见的描边；不再叠加阴影。
 *
 * `overflow-hidden` 不是装饰：卡片内的列表行会自绘底色（选中的 `bg-surface-4`、
 * 分组头的 `bg-surface-3`），不裁切就会把这些底色画到圆角外面，看起来是「该圆的地方成了直角」。
 * 圆角只保留一档 12px（rounded-xl），控件用 6px（rounded-md），内嵌件用 4px（rounded）。
 */
export function Card({ title, actions, className, bodyClassName, fill = false, children }: CardProps) {
	return (
		<section
			className={`min-w-0 flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-subtle ${
				fill ? "fb-fill flex" : "flex"
			} ${className ?? ""}`}
		>
			{title ? (
				<header className="flex shrink-0 items-center gap-2 border-b border-line-subtle px-3.5 py-2.5">
					<h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{title}</h2>
					{actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
				</header>
			) : null}
			<div className={`min-h-0 min-w-0 ${fill ? "flex flex-1 flex-col" : ""} ${bodyClassName ?? ""}`}>{children}</div>
		</section>
	);
}
