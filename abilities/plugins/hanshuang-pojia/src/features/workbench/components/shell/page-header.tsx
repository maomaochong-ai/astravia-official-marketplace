import type { ReactNode } from "react";

export interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
}

/** 每个页面顶端的一行标题 + 一句用途 + 右侧动作（含紫色 AI 按钮）。 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<div className="flex flex-wrap items-start gap-2 border-b border-line-subtle px-4 py-3">
			<div className="min-w-0 flex-1">
				<h1 className="truncate text-[14px] font-semibold text-text">{title}</h1>
				{description ? <p className="mt-0.5 text-[11px] leading-relaxed text-text-4">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
		</div>
	);
}
