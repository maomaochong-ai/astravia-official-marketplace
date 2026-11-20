import type { ReactNode } from "react";

export interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
}

/**
 * 每个页面顶端的一行「用途 + 动作」。
 *
 * 标题不在这里重复：顶栏面包屑已经写着当前页名，同一句话上下堆两次只是白占一行，
 * 矮屏上这一行就是最后一张卡被顶出去的那一截。标题仍保留在 DOM 里（sr-only h1），
 * 屏幕阅读器的文档结构与「跳至标题」不受影响。
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		// 不画下边框：面板里每页都有一条横线，加卡片头、列表行就是满屏横线。
		// 靠间距与字号分层，面板本身是白的、头部是白的，不会糊在一起。
		/*
		 * 不再自带 px：`.fb-main` 已经有 `--fb-pad` 内边距，再加一层会让页头文字比下方卡片右移 16px。
		 * 去掉后页头、tab、卡片三者左缘对齐。
		 */
		<div className="flex flex-wrap items-start gap-2 pb-1.5 pt-3">
			<div className="min-w-0 flex-1">
				<h1 className="sr-only">{title}</h1>
				{description ? <p className="fb-wrap text-[11.5px] leading-relaxed text-text-3">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
		</div>
	);
}
