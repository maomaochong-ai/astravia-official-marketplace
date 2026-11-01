import type { ReactNode } from "react";

interface WorkbenchNoticeProps {
	title: string;
	hint: string;
	/** 原始错误或键名，等宽显示；没有就不占位。 */
	detail?: string;
	action?: ReactNode;
}

/**
 * 面板「起不来 / 画不出来」共用的那一屏。
 *
 * 之前错误屏只有护栏里一份，启动卡住时则是无字骨架——同一块面板，两种失败长得完全不同，
 * 空白与「还没好」分不出来。这一屏是两者共同的形状：一句结论、一句出路、可选细节与动作。
 */
export function WorkbenchNotice({ title, hint, detail, action }: WorkbenchNoticeProps) {
	return (
		<div className="mahua-root flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 px-8 text-center">
			<span className="text-body-sm font-semibold text-ink">{title}</span>
			<span className="max-w-[520px] break-words text-[10px] leading-4 text-ink-soft">{hint}</span>
			{detail === undefined ? null : (
				<span className="max-w-[520px] break-words rounded-control bg-well px-3 py-2 font-mono text-[10px] leading-4 text-ink-faint">
					{detail}
				</span>
			)}
			{action}
		</div>
	);
}
