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
	/** 测试锚点：可见性由外层 className 控制，断言要能看到同一节点。 */
	testId?: string;
	children: ReactNode;
}

/**
 * 面板里所有内容块的外框。
 *
 * 三件事由 CSS 变量统一，页面不再各写一遍内边距：
 *   - 卡头与卡体都用 `--fb-ins`（面板窄时自动降档）；
 *   - 圆角只有一档 12px，`overflow-hidden` 必须留：列表行自绘底色
 *     （选中 `bg-surface-4`、分组头 `bg-surface-3`）不裁切就会画到圆角外面，
 *     看起来是「该圆的地方成了直角」；
 *   - 描边用 ring 而不是 border：border 会占 1px 宽，卡片和侧栏之间出现宽度不为整数的缝。
 */
export function Card({ title, actions, className, bodyClassName, fill = false, testId, children }: CardProps) {
	return (
		<section
			data-testid={testId}
			className={`flex min-w-0 flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line-subtle ${fill ? "fb-fill" : ""} ${className ?? ""}`}
		>
			{title ? (
				<header className="fb-card-head flex shrink-0 items-center gap-2 border-b border-line-subtle">
					<h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text" title={title}>
					{title}
				</h2>
					{actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
				</header>
			) : null}
			<div className={`min-h-0 min-w-0 ${fill ? "flex flex-1 flex-col" : ""} ${bodyClassName ?? "fb-card-body"}`}>{children}</div>
		</section>
	);
}
