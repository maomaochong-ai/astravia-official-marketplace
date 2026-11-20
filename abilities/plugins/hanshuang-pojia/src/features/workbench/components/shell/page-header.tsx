import type { ReactNode } from "react";

export interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
}

/** 每个页面顶端的一行标题 + 一句用途 + 右侧动作（含紫色 AI 按钮）。 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		// 不画下边框：面板里每页都有一条横线，加卡片头、列表行就是满屏横线。
		// 靠间距与字号分层，面板本身是白的、头部是白的，不会糊在一起。
		<div className="flex flex-wrap items-start gap-2 px-4 pb-1.5 pt-3">
			<div className="min-w-0 flex-1">
				<h1 className="truncate text-[14px] font-semibold text-text">{title}</h1>
				{description ? <p className="mt-0.5 text-[11px] leading-relaxed text-text-4">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
		</div>
	);
}
