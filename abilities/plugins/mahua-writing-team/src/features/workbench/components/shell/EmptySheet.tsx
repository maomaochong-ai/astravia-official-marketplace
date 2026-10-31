import type { ReactNode } from "react";

/**
 * 空的纸：没有书、没有伏笔、没有事件时都长这样。
 *
 * 只说明「现在没有」，不接着许诺「点击下面的按钮开始」——工作台的创建动作在侧栏对话里，
 * 所以空态最多给一句去处，不给操作。
 */
export function EmptySheet({
	icon,
	title,
	note,
	action,
}: {
	icon: string;
	title: string;
	note?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line px-6 py-10 text-center">
			<span className={`${icon} size-5 text-ink-faint`} />
			<p className="text-body-sm font-medium text-ink">{title}</p>
			{note && <p className="max-w-[36ch] text-micro leading-5 text-ink-soft">{note}</p>}
			{action}
		</div>
	);
}
